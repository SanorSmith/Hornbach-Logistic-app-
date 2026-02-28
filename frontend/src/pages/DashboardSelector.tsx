import { useNavigate } from 'react-router-dom';
import { Users, Truck, Monitor, Building2 } from 'lucide-react';

export default function DashboardSelector() {
  const navigate = useNavigate();

  const dashboards = [
    {
      title: 'LineFeeder',
      description: 'Hantera röda punkter och materialflöde',
      icon: Truck,
      path: '/linefeeder',
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      title: 'Admin',
      description: 'Systemadministration och användarhantering',
      icon: Users,
      path: '/admin',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      title: 'Team Leader',
      description: 'Teamöversikt och rapportering',
      icon: Building2,
      path: '/teamleader',
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      title: 'Monitor',
      description: 'Realtidsövervakning av alla punkter',
      icon: Monitor,
      path: '/monitor',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      title: 'Avdelning',
      description: 'Avdelningsspecifik punkthantering och QR-koder',
      icon: Building2,
      path: '/department',
      color: 'bg-indigo-500 hover:bg-indigo-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Godsmotagning Logistik
          </h1>
          <p className="text-xl text-gray-600">
            Välj din dashboard för att komma igång
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dashboards.map((dashboard) => {
            const Icon = dashboard.icon;
            return (
              <button
                key={dashboard.path}
                onClick={() => navigate(dashboard.path)}
                className={`${dashboard.color} text-white p-8 rounded-2xl shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-xl`}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <Icon size={48} />
                  </div>
                  <h2 className="text-2xl font-bold">{dashboard.title}</h2>
                  <p className="text-white/90">{dashboard.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
            Klicka på en dashboard för att komma åt systemet
          </p>
        </div>
      </div>
    </div>
  );
}
