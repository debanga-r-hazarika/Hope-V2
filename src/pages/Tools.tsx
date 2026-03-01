import { Wrench, FileText } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { ModernCard } from '../components/ui/ModernCard';
import { RawMaterialReportMaker } from '../components/RawMaterialReportMaker';

export function Tools() {
  const { toolName } = useParams();
  const navigate = useNavigate();

  if (toolName === 'RawMaterialReportMaker') {
    return <RawMaterialReportMaker onClose={() => navigate('/tools')} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-7 h-7 text-amber-600" />
            Tools
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Company tools for Daily Operations Management
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ModernCard
          className="p-6 cursor-pointer hover:shadow-md transition-shadow group border-2 border-transparent hover:border-indigo-100"
          onClick={() => navigate('/tools/RawMaterialReportMaker')}
        >
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Raw Material Report Maker
          </h3>
          <p className="text-sm text-gray-500">
            Generate customized PDF reports for raw materials locally.
          </p>
        </ModernCard>

        {/* Future tools can be added here as new ModernCards in the grid */}
      </div>
    </div>
  );
}
