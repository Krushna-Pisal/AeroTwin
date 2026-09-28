import { useState } from 'react'
import { MapPin, CheckCircle, Clock, Search, AlertCircle, X, ExternalLink } from 'lucide-react'
import { DataBadge } from '@/components/common/DataBadge'

const mockComplaints = [
  { id: 'TICKET-4921', type: 'Dust / Construction', location: 'Baner Rd, Pune', status: 'Open', date: '2 hours ago', lat: 18.559, lng: 73.786 },
  { id: 'TICKET-3810', type: 'Traffic Congestion', location: 'Swargate Junction', status: 'Investigating', date: '5 hours ago', lat: 18.501, lng: 73.858 },
  { id: 'TICKET-2719', type: 'Industrial Smoke', location: 'Bhosari MIDC', status: 'Resolved', date: '1 day ago', lat: 18.625, lng: 73.829 },
  { id: 'TICKET-8422', type: 'Waste Burning', location: 'Viman Nagar', status: 'Open', date: '1 day ago', lat: 18.567, lng: 73.914 },
  { id: 'TICKET-1102', type: 'Dust / Construction', location: 'Kalyani Nagar', status: 'Resolved', date: '2 days ago', lat: 18.545, lng: 73.906 },
]

export function ComplaintsDashboard() {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  
  const selected = mockComplaints.find(c => c.id === selectedTicket)

  return (
    <div className="flex h-full w-full bg-slate-50">
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Citizen Complaints</h1>
              <p className="text-text-secondary mt-1">Review and action environmental observations reported by citizens.</p>
            </div>
            <DataBadge type="CITIZEN_REPORTED" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="text-3xl font-bold text-text-primary mb-1">12</div>
              <div className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" /> Open Tickets
              </div>
            </div>
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="text-3xl font-bold text-text-primary mb-1">4</div>
              <div className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> Investigating
              </div>
            </div>
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="text-3xl font-bold text-text-primary mb-1">45</div>
              <div className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" /> Resolved (30d)
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-slate-50">
              <div className="relative w-64">
                <input 
                  type="text" 
                  placeholder="Search tickets..." 
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg bg-white hover:bg-slate-50">Filter</button>
                <button className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg bg-white hover:bg-slate-50">Export</button>
              </div>
            </div>
            
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b border-border text-text-secondary">
                <tr>
                  <th className="px-6 py-3 font-semibold">Ticket ID</th>
                  <th className="px-6 py-3 font-semibold">Issue Type</th>
                  <th className="px-6 py-3 font-semibold">Location</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {mockComplaints.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => setSelectedTicket(ticket.id)}
                    className={`cursor-pointer transition-colors ${selectedTicket === ticket.id ? 'bg-brand-primary/5' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-6 py-4 font-mono font-medium text-brand-primary">{ticket.id}</td>
                    <td className="px-6 py-4 font-medium text-text-primary">{ticket.type}</td>
                    <td className="px-6 py-4 text-text-secondary flex items-center gap-1"><MapPin size={14} /> {ticket.location}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        ticket.status === 'Open' ? 'bg-amber-100 text-amber-700' :
                        ticket.status === 'Investigating' ? 'bg-blue-100 text-blue-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted">{ticket.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ticket Inspector Sidebar */}
      {selected && (
        <div className="w-[400px] border-l border-border bg-surface shadow-[-8px_0_24px_rgba(15,23,42,0.04)] flex flex-col h-full animate-in slide-in-from-right-8">
          <div className="p-5 border-b border-border flex justify-between items-start bg-slate-50">
            <div>
              <div className="text-sm font-medium text-text-secondary mb-1">Ticket Details</div>
              <h2 className="text-xl font-mono font-bold text-text-primary">{selected.id}</h2>
            </div>
            <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Issue Type</div>
              <div className="font-medium text-text-primary">{selected.type}</div>
            </div>
            
            <div>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Location</div>
              <div className="flex items-start gap-2 bg-slate-100 p-3 rounded-lg border border-border">
                <MapPin size={18} className="text-text-secondary mt-0.5" />
                <div>
                  <div className="font-medium text-text-primary">{selected.location}</div>
                  <div className="text-xs text-text-secondary mt-1 font-mono">{selected.lat}, {selected.lng}</div>
                  <button className="text-xs text-brand-primary font-medium mt-2 flex items-center gap-1 hover:underline">
                    View on map <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Attached Media</div>
              <div className="h-32 bg-slate-100 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-text-muted">
                No photo provided
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Resolution Actions</div>
              <div className="space-y-2">
                <button className="w-full py-2.5 px-4 bg-brand-primary text-white rounded-lg font-medium text-sm hover:bg-brand-primary-hover transition-colors">
                  Mark as Investigating
                </button>
                <button className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors">
                  Resolve Ticket
                </button>
                <button className="w-full py-2.5 px-4 bg-white border border-border text-text-secondary hover:text-red-600 hover:border-red-200 rounded-lg font-medium text-sm transition-colors">
                  Reject (Spam/Invalid)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
