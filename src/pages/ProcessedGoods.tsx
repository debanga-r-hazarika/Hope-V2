import { useEffect, useState } from 'react';
import { RefreshCw, Box } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import { fetchProcessedGoods } from '../lib/operations';

interface ProcessedGoodsProps {
  accessLevel: AccessLevel;
}

export function ProcessedGoods({ accessLevel }: ProcessedGoodsProps) {
  const [goods, setGoods] = useState<ProcessedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProcessedGoods();
      setGoods(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processed goods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel]);

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Operations module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
        Note: Processed goods are automatically created from approved production batches. Manual entry is not allowed.
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{goods.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">In Stock</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">
            {goods.filter((g) => g.quantity_available > 0).length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-2xl font-semibold text-red-600 mt-1">
            {goods.filter((g) => g.quantity_available === 0).length}
          </p>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Available</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Production Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading processed goods...</span>
                  </div>
                </td>
              </tr>
            ) : goods.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Box className="w-8 h-8 text-gray-400" />
                    <span>No processed goods found</span>
                  </div>
                </td>
              </tr>
            ) : (
              goods.map((good) => (
                <tr key={good.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{good.product_type}</td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{good.batch_reference}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`font-semibold ${
                        good.quantity_available === 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {good.quantity_available} {good.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{good.production_date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                      {good.qa_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-gray-500">Loading processed goods...</span>
            </div>
          </div>
        ) : goods.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Box className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">No processed goods found</span>
            </div>
          </div>
        ) : (
          goods.map((good) => (
            <div key={good.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">{good.product_type}</h3>
                  <p className="text-xs text-gray-500 font-mono mt-1">Batch: {good.batch_reference}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  good.quantity_available === 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-green-50 text-green-600'
                }`}>
                  {good.quantity_available} {good.unit}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Production Date:</span>
                  <span className="ml-1 text-gray-900">{good.production_date}</span>
                </div>
                <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                  {good.qa_status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
