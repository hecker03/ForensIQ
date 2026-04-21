import { useEffect, useMemo, useState } from "react";
import PortalLayout from "../components/layout/PortalLayout";
import api, { extractApiError } from "../lib/api";
import useAuth from "../hooks/useAuth";

const initialForm = {
  title: "",
  category: "General",
  content: "",
};

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function Dashboard() {
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState("");
  const [error, setError] = useState("");

  const totalChars = useMemo(
    () => records.reduce((sum, record) => sum + (record.content?.length || 0), 0),
    [records],
  );

  useEffect(() => {
    let cancelled = false;

    const loadRecords = async () => {
      try {
        const response = await api.get("/records");
        if (!cancelled) {
          setRecords(response.data.records || []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(extractApiError(err, "Unable to load your input records"));
        }
      } finally {
        if (!cancelled) {
          setLoadingRecords(false);
        }
      }
    };

    loadRecords();

    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and input details are required");
      return;
    }

    try {
      setSaving(true);
      const response = await api.post("/records", {
        title: form.title,
        category: form.category,
        content: form.content,
      });

      setRecords((prev) => [response.data.record, ...prev]);
      setForm(initialForm);
      setError("");
    } catch (err) {
      setError(extractApiError(err, "Unable to save record"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId) => {
    try {
      setDeletingRecordId(recordId);
      await api.delete(`/records/${recordId}`);
      setRecords((prev) => prev.filter((record) => record._id !== recordId));
      setError("");
    } catch (err) {
      setError(extractApiError(err, "Unable to remove record"));
    } finally {
      setDeletingRecordId("");
    }
  };

  return (
    <PortalLayout
      title="Dashboard"
      subtitle="Track and persist forensic input activity. Every entry here is stored in MongoDB per user account."
    >
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-4 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
            Save Input Record
          </h2>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-[1fr_180px] gap-3">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={onChange("title")}
                  placeholder="Suspicious PowerShell Activity"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={onChange("category")}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40"
                >
                  <option>General</option>
                  <option>Memory Analysis</option>
                  <option>Network Artifact</option>
                  <option>IOC</option>
                  <option>Threat Intel</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest font-mono mb-2">
                Input Details
              </label>
              <textarea
                rows={8}
                value={form.content}
                onChange={onChange("content")}
                placeholder="Paste commands, observations, indicators, or analysis notes..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-500/40 resize-y"
              />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-cyan-400 text-gray-950 font-bold font-mono tracking-widest uppercase text-xs hover:bg-cyan-300 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving..." : "Store Record"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/65 backdrop-blur-xl p-4 md:p-6">
          <h2 className="text-sm uppercase tracking-[0.22em] font-mono text-cyan-400/80 mb-4">
            Operator Snapshot
          </h2>

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Operator
              </p>
              <p className="text-cyan-200 text-sm truncate">{user?.name}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Record Count
              </p>
              <p className="text-cyan-200 text-sm">{records.length}</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-800/50 p-3 sm:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-mono mb-1">
                Stored Character Volume
              </p>
              <p className="text-cyan-200 text-sm">{totalChars.toLocaleString()} chars</p>
            </div>
          </div>

          <h3 className="text-xs uppercase tracking-[0.2em] text-gray-400 font-mono mb-3">
            Recent Inputs
          </h3>

          {loadingRecords ? (
            <p className="text-sm text-gray-400">Loading records...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-gray-500">No records yet. Add your first input from the form.</p>
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {records.map((record) => (
                <article
                  key={record._id}
                  className="rounded-lg border border-gray-800 bg-gray-800/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm text-cyan-200 font-medium">{record.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 uppercase tracking-widest font-mono">
                        {record.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(record._id)}
                        disabled={deletingRecordId === record._id}
                        className="text-[11px] px-2 py-1 border border-red-500/40 rounded-md text-red-300 font-mono uppercase tracking-widest hover:bg-red-500/10 transition-colors disabled:opacity-60"
                      >
                        {deletingRecordId === record._id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-pre-wrap break-words">
                    {record.content}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-2 font-mono">
                    {formatDate(record.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </PortalLayout>
  );
}
