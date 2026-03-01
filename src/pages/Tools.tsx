import { useEffect, useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { fetchTools, createTool, updateTool, deleteTool, type Tool } from '../lib/tools';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';

export function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTools();
      setTools(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const created = await createTool({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
      setTools((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData({ name: '', description: '' });
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;
    setSubmitting(true);
    try {
      const updated = await updateTool(editingId, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
      setTools((prev) =>
        prev.map((t) => (t.id === editingId ? updated : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
      setFormData({ name: '', description: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update tool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubmitting(true);
    try {
      await deleteTool(id);
      setTools((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete tool');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setFormData({ name: tool.name, description: tool.description ?? '' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-7 h-7 text-amber-600" />
            Tools
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Company tools (not part of inventory). Add and manage tools your team uses.
          </p>
        </div>
        {!showForm && !editingId && (
          <ModernButton
            onClick={() => setShowForm(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Tool
          </ModernButton>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {(showForm || editingId) && (
        <ModernCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Tool' : 'New Tool'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. Drill, Saw"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[80px]"
                placeholder="Brief description or notes"
              />
            </div>
            <div className="flex gap-2">
              <ModernButton
                onClick={editingId ? handleUpdate : handleCreate}
                loading={submitting}
                disabled={!formData.name.trim()}
                icon={<Save className="w-4 h-4" />}
              >
                {editingId ? 'Save' : 'Add Tool'}
              </ModernButton>
              <ModernButton variant="ghost" onClick={cancelForm} icon={<X className="w-4 h-4" />}>
                Cancel
              </ModernButton>
            </div>
          </div>
        </ModernCard>
      )}

      <ModernCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading tools...</div>
        ) : tools.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tools yet. Add one to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tools.map((tool) => (
              <li
                key={tool.id}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{tool.name}</p>
                  {tool.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{tool.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {deleteConfirmId === tool.id ? (
                    <>
                      <span className="text-sm text-gray-600">Delete?</span>
                      <ModernButton
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(tool.id)}
                        loading={submitting}
                      >
                        Yes
                      </ModernButton>
                      <ModernButton size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                        No
                      </ModernButton>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(tool)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(tool.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModernCard>
    </div>
  );
}
