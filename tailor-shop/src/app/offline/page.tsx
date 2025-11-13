export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="w-24 h-24 mx-auto text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Offline</h1>

        <p className="text-gray-600 mb-6">
          Smart Trendz requires an internet connection to load new pages. Your previously
          viewed pages and data may still be available.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">Offline Features:</h2>
          <ul className="text-sm text-blue-800 text-left space-y-1">
            <li>• View cached orders and customers</li>
            <li>• Create new orders (will sync when online)</li>
            <li>• Record payments (will sync when online)</li>
            <li>• View previously loaded pages</li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Try Again
        </button>

        <div className="mt-4">
          <a
            href="/"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
