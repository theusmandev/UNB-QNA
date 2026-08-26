import { Link } from 'react-router-dom'
import Header from '../components/Header'

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#efeae2]">
      <Header subtitle="Page Not Found" />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-sm w-full mx-auto space-y-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-wa-ink">Page not found</h2>
          <p className="text-[15px] text-wa-muted">
            The link you followed may be broken, or the page may have been removed.
          </p>
          
          <div className="pt-4">
            <Link 
              to="/"
              className="inline-flex w-full justify-center rounded-full bg-wa-teal px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm hover:bg-wa-teal/90"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
