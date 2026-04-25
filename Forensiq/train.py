"""
ForensIQ — train.py
====================
Trains 3 models on features extracted by plugins.py:
  1. Random Forest    → main malware classifier
  2. Decision Tree    → explainable rules (for visualization)
  3. Isolation Forest → anomaly detection (catches unknown malware)

Usage:
  python3 train.py train                              ← train all models
  python3 train.py predict ./output/abc_features.csv  ← predict on new dump
"""

import os
import sys
import glob
import pickle
import warnings
import pandas as pd
import numpy as np
warnings.filterwarnings("ignore")

from sklearn.ensemble        import RandomForestClassifier, IsolationForest
from sklearn.tree            import DecisionTreeClassifier, export_text
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics         import (classification_report,
                                     confusion_matrix, roc_auc_score)


# ══════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════

# These are legitimate system process names
# They are ONLY malicious when they have actual suspicious indicators
# Never label them malicious just because of their name
SYSTEM_PROCESS_NAMES = {
    "system", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "winlogon.exe", "services.exe",
    "lsass.exe", "lsm.exe", "svchost.exe", "spoolsv.exe",
    "explorer.exe", "taskhost.exe", "taskhostw.exe",
    "dwm.exe", "sihost.exe", "ctfmon.exe", "audiodg.exe",
    "dllhost.exe", "msdtc.exe", "vssvc.exe", "wmiprvse.exe",
    "searchindexer.", "searchindexer.exe",
    "runtimebroker.", "runtimebroker.exe",
    "fontdrvhost.ex", "fontdrvhost.exe",
    "userinit.exe", "conhost.exe", "wmiApSrv.exe",
}

# These names are confirmed malware — always label 1
# Only include names that are NEVER legitimate
KNOWN_MALWARE_NAMES = {
    "oneetx.exe",
    "rootkit.exe",
    "mimikatz.exe",
    "tun2socks.exe",
    "meterpreter.exe",
}

# Columns to drop — not useful for model training
DROP_COLS = {
    "pid",          # changes every dump — not a generalizable feature
    "name",         # model should not memorize "System = clean"
    "ppid",         # changes every dump
    "source_file",  # metadata — not a feature
    "label",        # target variable — not an input
}


# ══════════════════════════════════════════════════════════════
# STEP 1 — LOAD ALL FEATURE FILES
# ══════════════════════════════════════════════════════════════

def load_all_features(output_dir="./output"):
    """
    Loads all *_features.csv files from output directory
    and combines them into one dataframe.

    Input:  directory path containing _features.csv files
    Output: combined pandas DataFrame
    """
    pattern   = os.path.join(output_dir, "*_features.csv")
    all_files = glob.glob(pattern)

    if not all_files:
        print(f"❌ No *_features.csv files found in: {output_dir}")
        print(f"   Make sure you ran plugins.py on your dump files first.")
        return None

    dfs = []
    for f in sorted(all_files):
        try:
            df = pd.read_csv(f)
            df["source_file"] = os.path.basename(f)
            dfs.append(df)
            print(f"  ✅ {os.path.basename(f):45s} → {len(df):4d} rows")
        except Exception as e:
            print(f"  ⚠️  Could not read {f}: {e}")

    if not dfs:
        return None

    combined = pd.concat(dfs, ignore_index=True)
    print(f"\n  Total combined rows: {len(combined)}")
    return combined


# ══════════════════════════════════════════════════════════════
# STEP 2 — AUTO LABEL
# ══════════════════════════════════════════════════════════════

def auto_label(row):
    """
    Labels each process as:
      1  = malicious
      0  = clean
     -1  = uncertain (will be removed before training)

    Logic:
    - System process names → clean UNLESS actually suspicious
    - Known malware names  → always malicious
    - Structural indicators (double extension, typo) → always malicious
    - Score based fallback → uses feature combinations
    """
    name = str(row.get("name", "")).lower().strip()

    # ── 1. Corrupt / empty entries ───────────────────────────
    # Memory address as name = corrupt pslist entry
    if name.startswith("0x") or name == "" or name == "nan":
        return -1

    # ── 2. System process names ──────────────────────────────
    # Clean UNLESS something is actually wrong with them
    if name in SYSTEM_PROCESS_NAMES:
        actually_suspicious = (
            row.get("wrong_parent", 0)          == 1 or
            row.get("svchost_wrong_parent", 0)  == 1 or
            row.get("has_malfind", 0)           == 1 or
            row.get("confirmed_c2", 0)          == 1 or
            row.get("is_hidden", 0)             == 1 or
            row.get("wrong_session", 0)         == 1 or
            row.get("wow64_system", 0)          == 1 or
            row.get("widespread_injection", 0)  == 1
        )
        if not actually_suspicious:
            return 0  # legitimate system process — clean
        # If suspicious → fall through to score check

    # ── 3. Known malware names ───────────────────────────────
    if name in KNOWN_MALWARE_NAMES:
        return 1

    # ── 4. Structural indicators ─────────────────────────────
    # These are always malicious regardless of name
    if row.get("double_extension", 0)    == 1:  return 1
    if row.get("typosquatting", 0)       == 1:  return 1
    if row.get("confirmed_c2", 0)        == 1:  return 1
    if row.get("widespread_injection", 0)== 1:  return 1

    # ── 5. Score based ───────────────────────────────────────
    score = (
        row.get("has_malfind", 0)           * 4 +
        row.get("has_external_ip", 0)       * 2 +
        row.get("wrong_parent", 0)          * 3 +
        row.get("svchost_wrong_parent", 0)  * 4 +
        row.get("is_hidden", 0)             * 4 +
        row.get("zero_threads", 0)          * 2 +
        row.get("wow64_system", 0)          * 2 +
        row.get("suspicious_cmdline", 0)    * 3 +
        row.get("wrong_session", 0)         * 2 +
        row.get("double_extension", 0)      * 5 +
        row.get("typosquatting", 0)         * 5 +
        row.get("scr_executable", 0)        * 3
    )

    if score >= 6:    return 1    # strong evidence → malicious
    elif score == 0:  return 0    # no evidence     → clean
    else:             return -1   # weak evidence   → uncertain, skip


# ══════════════════════════════════════════════════════════════
# STEP 3 — PREPARE DATA
# ══════════════════════════════════════════════════════════════

def prepare_data(df, manual_labels_csv=None):
    """
    Full data preparation pipeline:
      1. Remove corrupt rows
      2. Apply labels (auto + manual override)
      3. Remove uncertain rows
      4. Select feature columns
      5. Handle missing values
      6. Fix data types
      7. Report class balance + feature stats

    Input:
      df                 → combined features dataframe
      manual_labels_csv  → optional CSV with ground truth labels

    Output:
      X             → feature matrix (float)
      y             → labels (int 0 or 1)
      feature_cols  → list of feature column names
      df_labelled   → labelled dataframe (for saving)
    """
    print("\n[+] Preparing data...")
    original_len = len(df)

    # ── Step 1: Remove corrupt rows ──────────────────────────

    # PID 0 is fake idle process
    df = df[df["pid"] != 0].copy()

    # Name is a memory address = corrupt pslist entry
    df = df[~df["name"].astype(str).str.startswith("0x", na=False)].copy()

    # Name is NaN or empty
    df = df[df["name"].astype(str).str.strip() != ""].copy()
    df = df[df["name"].astype(str) != "nan"].copy()

    removed = original_len - len(df)
    print(f"  Removed {removed} corrupt rows → {len(df)} remaining")

    # ── Step 2: Apply auto labels ─────────────────────────────
    df["label"] = df.apply(auto_label, axis=1)

    # ── Step 3: Apply manual labels (override auto) ───────────
    if manual_labels_csv and os.path.exists(manual_labels_csv):
        manual = pd.read_csv(manual_labels_csv)
        print(f"\n  Loading manual labels: {len(manual)} entries")

        overridden = 0
        for _, mrow in manual.iterrows():
            inv_id = str(mrow["investigation_id"])
            pid    = int(mrow["pid"])
            label  = int(mrow["label"])

            mask = (
                df["source_file"].str.contains(inv_id, na=False, regex=False) &
                (df["pid"] == pid)
            )
            if mask.sum() > 0:
                df.loc[mask, "label"] = label
                overridden += mask.sum()

        print(f"  Overrode {overridden} labels with manual ground truth")
    else:
        print("\n  ⚠️  No manual_labels.csv found — using auto labels only")
        print("      Create manual_labels.csv for better accuracy!")

    # ── Step 4: Show label distribution ──────────────────────
    mal  = (df["label"] == 1).sum()
    clean= (df["label"] == 0).sum()
    unc  = (df["label"] == -1).sum()
    print(f"\n  Label distribution:")
    print(f"  Malicious (1):  {mal}")
    print(f"  Clean     (0):  {clean}")
    print(f"  Uncertain (-1): {unc} → will be removed")

    if mal == 0:
        print("\n  ❌ No malicious samples found!")
        print("     Check your manual_labels.csv or feature columns.")
        return None, None, None, None

    # Remove uncertain
    df_labelled = df[df["label"] != -1].copy()
    print(f"\n  Training rows: {len(df_labelled)}")

    # ── Step 5: Select feature columns ───────────────────────
    feature_cols = [
        c for c in df_labelled.columns
        if c not in DROP_COLS
        and df_labelled[c].dtype in [
            "int64", "float64", "bool",
            "int32", "uint8", "float32"
        ]
    ]

    print(f"\n  Feature columns ({len(feature_cols)}):")
    for i, col in enumerate(feature_cols):
        print(f"    {i+1:2}. {col}")

    X = df_labelled[feature_cols].copy()
    y = df_labelled["label"].astype(int)

    # ── Step 6: Handle missing values ────────────────────────
    missing_before = X.isnull().sum().sum()

    for col in feature_cols:
        if col == "threads":
            X[col] = X[col].fillna(0)       # no threads = 0
        elif col == "session":
            X[col] = X[col].fillna(-1)      # system process = -1
        elif "entropy" in col:
            median = X[col].median()
            X[col] = X[col].fillna(median)  # entropy = median if not dumped
        else:
            X[col] = X[col].fillna(0)       # all binary flags = 0

    missing_after = X.isnull().sum().sum()
    if missing_before > 0:
        print(f"\n  Missing values: {missing_before} → {missing_after} ✅")
    else:
        print(f"\n  Missing values: None ✅")

    # ── Step 7: Fix data types ────────────────────────────────
    # Convert booleans to int (True→1, False→0)
    for col in feature_cols:
        if X[col].dtype == bool:
            X[col] = X[col].astype(int)

    # All to float for sklearn
    X = X.astype(float)

    # ── Step 8: Class balance report ─────────────────────────
    mal_count   = int(y.sum())
    clean_count = int(len(y) - y.sum())
    ratio = clean_count / mal_count if mal_count > 0 else 0

    print(f"\n  Class balance: {clean_count} clean vs {mal_count} malicious")
    print(f"  Imbalance ratio: {ratio:.1f}:1")
    if ratio > 10:
        print(f"  ⚠️  High imbalance → using class_weight='balanced'")
    elif ratio > 3:
        print(f"  ⚠️  Moderate imbalance → model will handle it")
    else:
        print(f"  ✅ Good balance")

    # ── Step 9: Feature usefulness report ────────────────────
    print(f"\n  Feature comparison (malicious avg vs clean avg):")
    print(f"  {'Feature':<30} {'Malicious':>12} {'Clean':>10}  Signal")
    print(f"  {'-'*60}")
    for col in feature_cols:
        mal_avg   = float(X[y == 1][col].mean())
        clean_avg = float(X[y == 0][col].mean())
        diff      = abs(mal_avg - clean_avg)
        signal    = "✅ useful" if diff > 0.05 else "— low signal"
        print(f"  {col:<30} {mal_avg:>12.3f} {clean_avg:>10.3f}  {signal}")

    return X, y, feature_cols, df_labelled


# ══════════════════════════════════════════════════════════════
# STEP 4 — TRAIN RANDOM FOREST
# ══════════════════════════════════════════════════════════════

def train_random_forest(X, y, feature_cols):
    """
    Trains main classifier.

    Input:  X (features), y (labels), feature_cols (names)
    Output: trained model, feature importance dataframe
    """
    print(f"\n{'='*55}")
    print(f"[+] Training Random Forest...")
    print(f"{'='*55}")

    n = len(X)

    # Train/test split — only if enough samples
    if n >= 20:
        stratify = y if y.sum() >= 2 else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size  = 0.2,
            random_state = 42,
            stratify   = stratify,
        )
        print(f"  Train: {len(X_train)} | Test: {len(X_test)}")
    else:
        X_train, X_test = X, X
        y_train, y_test = y, y
        print(f"  ⚠️  Only {n} samples — using all for train + test")

    # Train
    rf = RandomForestClassifier(
        n_estimators   = 100,
        class_weight   = "balanced",   # handles imbalanced data
        random_state   = 42,
        max_depth      = 10,
        min_samples_leaf = 1,
    )
    rf.fit(X_train, y_train)

    # Evaluate
    y_pred = rf.predict(X_test)
    y_prob = rf.predict_proba(X_test)[:, 1]

    print(f"\n  Classification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names = ["Clean", "Malicious"],
        zero_division = 0,
    ))

    # ROC AUC
    if len(set(y_test)) > 1:
        auc = roc_auc_score(y_test, y_prob)
        print(f"  ROC-AUC Score: {auc:.3f}")
        print(f"  (1.0 = perfect | 0.5 = random guessing)")

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    print(f"\n  Confusion Matrix:")
    print(f"                    Predicted")
    print(f"                    Clean    Malicious")
    print(f"  Actual Clean      {cm[0][0]:<8} {cm[0][1]}")
    print(f"  Actual Malicious  {cm[1][0]:<8} {cm[1][1]}")
    if cm[0][1] > 0:
        print(f"  → {cm[0][1]} clean processes incorrectly flagged (false positive)")
    if cm[1][0] > 0:
        print(f"  → {cm[1][0]} malicious processes missed (false negative)")

    # Cross validation
    if n >= 10:
        cv = min(5, int(y.sum()))  # cv folds cant exceed malicious count
        if cv >= 2:
            scores = cross_val_score(
                rf, X, y, cv=cv, scoring="f1_weighted")
            print(f"\n  Cross-Validation F1 ({cv}-fold): "
                  f"{scores.mean():.3f} ± {scores.std():.3f}")

    # Feature importance
    imp_df = pd.DataFrame({
        "feature":    feature_cols,
        "importance": rf.feature_importances_,
    }).sort_values("importance", ascending=False)

    print(f"\n  Feature Importance (Top 10):")
    print(f"  {'Feature':<30} {'Score':>8}  Bar")
    print(f"  {'-'*55}")
    for _, row in imp_df.head(10).iterrows():
        bar = "█" * max(1, int(row["importance"] * 60))
        print(f"  {row['feature']:<30} {row['importance']:>8.4f}  {bar}")

    return rf, imp_df


# ══════════════════════════════════════════════════════════════
# STEP 5 — TRAIN DECISION TREE (explainability)
# ══════════════════════════════════════════════════════════════

def train_decision_tree(X, y, feature_cols):
    """
    Trains a shallow Decision Tree for visualization.
    Not used for production prediction — only for explanation.

    Input:  X, y, feature_cols
    Output: trained Decision Tree model
    """
    print(f"\n{'='*55}")
    print(f"[+] Training Decision Tree (for visualization)...")
    print(f"{'='*55}")

    dt = DecisionTreeClassifier(
        max_depth    = 4,            # shallow = readable
        class_weight = "balanced",
        random_state = 42,
    )
    dt.fit(X, y)

    # Print human readable rules
    rules = export_text(dt, feature_names=list(feature_cols))
    print("\n  Decision Tree Rules (depth 4):")
    print("  " + rules.replace("\n", "\n  ")[:2000])

    # Simple accuracy
    acc = (dt.predict(X) == y).mean()
    print(f"\n  Training accuracy: {acc:.3f}")
    print(f"  (Note: use Random Forest for actual predictions)")

    return dt


# ══════════════════════════════════════════════════════════════
# STEP 6 — TRAIN ISOLATION FOREST (anomaly)
# ══════════════════════════════════════════════════════════════

def train_isolation_forest(X_all):
    """
    Trains anomaly detector on ALL processes — no labels needed.
    Catches unknown malware that doesn't match known patterns.

    Input:  X_all → all processes including uncertain ones
    Output: trained Isolation Forest model
    """
    print(f"\n{'='*55}")
    print(f"[+] Training Isolation Forest (anomaly detection)...")
    print(f"{'='*55}")
    print(f"  Training on {len(X_all)} processes (no labels needed)")

    iso = IsolationForest(
        n_estimators  = 100,
        contamination = 0.1,    # assume ~10% are anomalous
        random_state  = 42,
    )
    iso.fit(X_all)

    scores      = iso.decision_function(X_all)
    predictions = iso.predict(X_all)  # -1=anomaly, 1=normal

    anomalies = (predictions == -1).sum()
    print(f"  Anomalies found in training data: {anomalies} / {len(X_all)}")
    print(f"  Score range: {scores.min():.3f} to {scores.max():.3f}")
    print(f"  (More negative = more anomalous = more suspicious)")

    return iso


# ══════════════════════════════════════════════════════════════
# STEP 7 — SAVE MODELS
# ══════════════════════════════════════════════════════════════

def save_models(rf, dt, iso, feature_cols, imp_df,
                model_dir="./models"):
    """
    Saves all trained models and metadata.

    Input:  trained models, feature columns, importance df
    Output: .pkl files in model_dir
    """
    os.makedirs(model_dir, exist_ok=True)

    # Random Forest
    with open(f"{model_dir}/rf_model.pkl", "wb") as f:
        pickle.dump({
            "model":        rf,
            "feature_cols": feature_cols,
            "type":         "random_forest",
        }, f)

    # Decision Tree
    with open(f"{model_dir}/dt_model.pkl", "wb") as f:
        pickle.dump({
            "model":        dt,
            "feature_cols": feature_cols,
            "type":         "decision_tree",
        }, f)

    # Isolation Forest
    with open(f"{model_dir}/iso_model.pkl", "wb") as f:
        pickle.dump({
            "model":        iso,
            "feature_cols": feature_cols,
            "type":         "isolation_forest",
        }, f)

    # Feature importance CSV
    imp_df.to_csv(f"{model_dir}/feature_importance.csv", index=False)

    print(f"\n  ✅ Saved to {model_dir}/")
    print(f"     rf_model.pkl          ← main classifier (use this for predictions)")
    print(f"     dt_model.pkl          ← explainable rules (for visualization)")
    print(f"     iso_model.pkl         ← anomaly detector (catches unknown malware)")
    print(f"     feature_importance.csv ← which features matter most")


# ══════════════════════════════════════════════════════════════
# STEP 8 — PREDICT ON NEW DUMP
# ══════════════════════════════════════════════════════════════

def predict(features_csv, model_dir="./models"):
    """
    Runs trained models on a new dump's features CSV.

    Input:
      features_csv → path to *_features.csv from plugins.py
      model_dir    → directory with saved .pkl files

    Output:
      *_predictions.csv with verdict per process
      Console printout of malicious processes
    """
    print(f"\n{'='*55}")
    print(f"[+] Predicting: {features_csv}")
    print(f"{'='*55}")

    # ── Load models ───────────────────────────────────────────
    try:
        with open(f"{model_dir}/rf_model.pkl", "rb") as f:
            rf_saved = pickle.load(f)
        with open(f"{model_dir}/iso_model.pkl", "rb") as f:
            iso_saved = pickle.load(f)
    except FileNotFoundError:
        print("❌ Model files not found. Run training first:")
        print("   python3 train.py train")
        return None

    rf_model     = rf_saved["model"]
    iso_model    = iso_saved["model"]
    feature_cols = rf_saved["feature_cols"]

    # ── Load features ─────────────────────────────────────────
    df = pd.read_csv(features_csv)
    print(f"  Loaded {len(df)} processes")

    # Remove corrupt rows same as training
    df = df[df["pid"] != 0].copy()
    df = df[~df["name"].astype(str).str.startswith("0x", na=False)].copy()

    # Handle missing columns — add with 0 if not present
    for col in feature_cols:
        if col not in df.columns:
            print(f"  ⚠️  Missing column '{col}' → filling with 0")
            df[col] = 0

    X = df[feature_cols].fillna(0).astype(float)

    # ── Random Forest prediction ──────────────────────────────
    rf_pred = rf_model.predict(X)
    rf_prob = rf_model.predict_proba(X)[:, 1]

    # ── Isolation Forest prediction ───────────────────────────
    iso_pred   = iso_model.predict(X)           # -1=anomaly, 1=normal
    iso_scores = iso_model.decision_function(X) # lower = more anomalous

    # ── Attach results to dataframe ───────────────────────────
    df["rf_malicious_prob"] = (rf_prob * 100).round(1)
    df["rf_prediction"]     = rf_pred
    df["iso_anomaly"]       = (iso_pred == -1).astype(int)
    df["iso_score"]         = iso_scores.round(4)

    # ── Final combined verdict ────────────────────────────────
    # Malicious if:
    #   RF says malicious (rf_prediction=1)
    #   OR (ISO says anomaly AND RF probability is moderate >30%)
    df["final_verdict"] = df.apply(
        lambda r: "MALICIOUS" if (
            r["rf_prediction"] == 1 or
            (r["iso_anomaly"] == 1 and r["rf_malicious_prob"] > 30)
        ) else "CLEAN",
        axis=1
    )

    # ── Display results ───────────────────────────────────────
    malicious = df[df["final_verdict"] == "MALICIOUS"].copy()
    clean     = df[df["final_verdict"] == "CLEAN"].copy()

    print(f"\n  Results: {len(malicious)} malicious | {len(clean)} clean")

    if not malicious.empty:
        print(f"\n  🚨 MALICIOUS PROCESSES:")
        print(f"  {'PID':<8} {'Name':<25} {'RF Prob%':>10} "
              f"{'ISO Anomaly':>12} {'Verdict'}")
        print(f"  {'-'*65}")
        show = malicious.sort_values("rf_malicious_prob", ascending=False)
        for _, row in show.iterrows():
            iso_flag = "🔴 YES" if row["iso_anomaly"] else "   no"
            print(f"  {int(row['pid']):<8} {str(row['name']):<25} "
                  f"{row['rf_malicious_prob']:>9.1f}% "
                  f"{iso_flag:>12}  MALICIOUS 🚨")
    else:
        print(f"\n  ✅ No malicious processes detected")

    print(f"\n  ✅ CLEAN PROCESSES: {len(clean)}")

    # ── Save predictions ──────────────────────────────────────
    out_path = features_csv.replace("_features.csv", "_predictions.csv")
    df.to_csv(out_path, index=False)
    print(f"\n  💾 Predictions saved: {out_path}")

    return df


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":

    mode = sys.argv[1] if len(sys.argv) > 1 else "train"

    # ── TRAINING MODE ─────────────────────────────────────────
    if mode == "train":

        print("\n" + "="*55)
        print("  ForensIQ — Model Training")
        print("="*55)

        OUTPUT_DIR  = "./output"
        MODEL_DIR   = "./models"
        MANUAL_CSV  = "./manual_labels.csv"

        # Step 1 — Load all feature files
        print("\n[+] Loading feature files...")
        df_all = load_all_features(OUTPUT_DIR)
        if df_all is None:
            sys.exit(1)

        # Step 2+3 — Prepare data with labels
        X, y, feature_cols, df_labelled = prepare_data(
            df_all,
            manual_labels_csv=MANUAL_CSV,
        )
        if X is None:
            sys.exit(1)

        # Save labelled training data
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        df_labelled.to_csv(
            f"{OUTPUT_DIR}/training_data.csv", index=False)
        print(f"\n  💾 Training data saved: {OUTPUT_DIR}/training_data.csv")

        # Step 4 — Train Random Forest
        rf_model, imp_df = train_random_forest(X, y, feature_cols)

        # Step 5 — Train Decision Tree
        dt_model = train_decision_tree(X, y, feature_cols)

        # Step 6 — Train Isolation Forest on ALL rows
        # Use all numeric features from full dataset
        # (not just labelled — ISO doesn't need labels)
        all_feature_cols = [
            c for c in df_all.columns
            if c not in DROP_COLS
            and df_all[c].dtype in [
                "int64", "float64", "bool",
                "int32", "uint8", "float32"
            ]
        ]
        # Remove corrupt rows first
        df_iso = df_all[df_all["pid"] != 0].copy()
        df_iso = df_iso[
            ~df_iso["name"].astype(str).str.startswith("0x", na=False)
        ].copy()
        X_all = df_iso[all_feature_cols].fillna(0).astype(float)
        iso_model = train_isolation_forest(X_all)

        # Step 7 — Save all models
        save_models(rf_model, dt_model, iso_model,
                    feature_cols, imp_df, MODEL_DIR)

        # Final summary
        print(f"\n{'='*55}")
        print(f"  TRAINING COMPLETE")
        print(f"{'='*55}")
        print(f"  Dumps analyzed:    {df_all['source_file'].nunique()}")
        print(f"  Total processes:   {len(df_all)}")
        print(f"  Training rows:     {len(X)}")
        print(f"  Malicious:         {int(y.sum())}")
        print(f"  Clean:             {int(len(y) - y.sum())}")
        print(f"  Features used:     {len(feature_cols)}")
        print(f"\n  Next step:")
        print(f"  python3 train.py predict ./output/<id>_features.csv")

    # ── PREDICT MODE ──────────────────────────────────────────
    elif mode == "predict":

        if len(sys.argv) < 3:
            print("Usage: python3 train.py predict "
                  "./output/<investigation_id>_features.csv")
            sys.exit(1)

        features_csv = sys.argv[2]
        if not os.path.exists(features_csv):
            print(f"❌ File not found: {features_csv}")
            sys.exit(1)

        result = predict(features_csv, model_dir="./models")

    # ── UNKNOWN MODE ──────────────────────────────────────────
    else:
        print("Usage:")
        print("  python3 train.py train")
        print("  python3 train.py predict ./output/abc123_features.csv")
        sys.exit(1)