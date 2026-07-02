import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, where, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Search, Filter, MapPin, ChevronDown } from "lucide-react";

export function CustomersView({ currentUid }: { currentUid: string | null }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerLimit, setCustomerLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCustomerLimit(50); // reset limit on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (!currentUid) return;

    let q;
    const baseCol = collection(db, `users/${currentUid}/customers`);
    
    // Server-side search by accountName (case-sensitive prefix)
    if (debouncedSearch) {
      q = query(
        baseCol,
        orderBy("accountName"),
        where("accountName", ">=", debouncedSearch),
        where("accountName", "<=", debouncedSearch + "\uf8ff"),
        limit(customerLimit)
      );
    } else {
      q = query(baseCol, orderBy("accountName"), limit(customerLimit));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
      setHasMore(snapshot.docs.length === customerLimit);
    }, (error) => {
      console.error("Error fetching customers:", error);
    });

    return () => unsub();
  }, [currentUid, debouncedSearch, customerLimit]);

  const uniqueProjects = Array.from(new Set(customers.map(c => c.project).filter(Boolean)));

  const filteredCustomers = customers.filter(c => {
    const matchesProject = projectFilter ? c.project === projectFilter : true;
    const matchesStatus = statusFilter ? c.status === statusFilter : true;
    return matchesProject && matchesStatus;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-on-surface tracking-tight">Customer Database</h1>
          <p className="text-on-surface-variant mt-1 text-sm md:text-base">Manage and view your customer records</p>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search by Account Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
            >
              <option value="">All Projects</option>
              {uniqueProjects.map((p: any) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Disconnected">Disconnected</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-lowest border-b border-outline-variant">
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Account No.</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Account Name</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Project</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Phase/Site</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Block/Lot</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">GPS Position</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Meter Serial</th>
                <th className="px-4 py-3 font-medium text-sm text-on-surface-variant whitespace-nowrap">Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-on-surface-variant">
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-outline-variant/50 hover:bg-surface-container-lowest transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{customer.accountNumber}</td>
                    <td className="px-4 py-3 text-sm">{customer.accountName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">{customer.contactNumber || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        customer.status === 'Active' ? 'bg-primary/10 text-primary' : 
                        customer.status === 'Disconnected' ? 'bg-error/10 text-error' : 
                        'bg-secondary/10 text-secondary'
                      }`}>
                        {customer.status || "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{customer.project || "-"}</td>
                    <td className="px-4 py-3 text-sm">{customer.phaseSite || "-"}</td>
                    <td className="px-4 py-3 text-sm">{customer.blockLot || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      {customer.gpsPosition ? (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${customer.gpsPosition.latitude},${customer.gpsPosition.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          View
                        </a>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-on-surface-variant">{customer.meterSerialNumber || "-"}</td>
                    <td className="px-4 py-3 text-sm">{customer.accountType || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMore && filteredCustomers.length > 0 && (
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-center">
            <button
              onClick={() => setCustomerLimit(prev => prev + 50)}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline-variant text-on-surface rounded-lg hover:bg-surface-container-low transition-colors text-sm font-medium shadow-sm"
            >
              <ChevronDown className="w-4 h-4" /> Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
