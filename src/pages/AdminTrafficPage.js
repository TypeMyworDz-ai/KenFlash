import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminTrafficPage.css'; // We'll create this CSS file next

// Define the admin email for testing purposes
const ADMIN_EMAIL = 'admin@kenyaflashing.com';

function AdminTrafficPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminId, setAdminId] = useState(null);

  const [trafficLogs, setTrafficLogs] = useState([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [popularPages, setPopularPages] = useState([]);

  // Admin authentication check
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === ADMIN_EMAIL) {
        setAdminId(user.id);
      } else {
        alert("Access Denied: You must be an admin to view this page.");
        logout();
        navigate('/');
      }
    };
    checkAdminStatus();
  }, [navigate, logout]);

  // Fetch traffic data
  useEffect(() => {
    if (!adminId) return;

    const fetchTrafficData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all traffic logs (or a recent subset for performance)
        const { data, error: fetchError } = await supabase
          .from('traffic_logs')
          .select('*')
          .order('visited_at', { ascending: false });

        if (fetchError) throw fetchError;
        setTrafficLogs(data || []);

        // Calculate summary statistics
        const visits = data?.length || 0;
        setTotalVisits(visits);

        const uniqueEmails = new Set();
        data?.forEach(log => {
          if (log.viewer_email) uniqueEmails.add(log.viewer_email);
        });
        setUniqueVisitors(uniqueEmails.size);

        // Calculate popular pages
        const pageCounts = {};
        data?.forEach(log => {
          pageCounts[log.page_path] = (pageCounts[log.page_path] || 0) + 1;
        });
        const sortedPages = Object.entries(pageCounts)
          .map(([path, count]) => ({ path, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); // Top 5 popular pages
        setPopularPages(sortedPages);

      } catch (err) {
        setError(err.message || 'Failed to fetch traffic data.');
        console.error('Error fetching traffic data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrafficData();
  }, [adminId]);

  if (loading) {
    return <div className="admin-traffic-container"><p>Loading traffic data...</p></div>;
  }

  if (error) {
    return <div className="admin-traffic-container"><p className="error-message">{error}</p></div>;
  }

  if (!adminId) {
    return <div className="admin-traffic-container"><p>Authenticating admin...</p></div>;
  }

  return (
    <div className="admin-traffic-container">
      <h2>Website Traffic Overview</h2>
      <p>Monitor key metrics and popular pages to understand user engagement.</p>

      <div className="traffic-summary-grid">
        <div className="summary-card">
          <h3>Total Visits</h3>
          <p className="summary-value">{totalVisits.toLocaleString()}</p>
          <p className="summary-description">All recorded page views</p>
        </div>
        <div className="summary-card">
          <h3>Unique Visitors</h3>
          <p className="summary-value">{uniqueVisitors.toLocaleString()}</p>
          <p className="summary-description">Distinct email addresses/sessions</p>
        </div>
      </div>

      <div className="traffic-details-section">
        <h3>Top 5 Popular Pages</h3>
        {popularPages.length === 0 ? (
          <p className="no-data">No page view data available yet.</p>
        ) : (
          <div className="popular-pages-list-wrapper">
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>Page Path</th>
                  <th>Visits</th>
                </tr>
              </thead>
              <tbody>
                {popularPages.map((page, index) => (
                  <tr key={index}>
                    <td>{page.path}</td>
                    <td>{page.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="traffic-details-section">
        <h3>Recent Traffic Logs</h3>
        {trafficLogs.length === 0 ? (
          <p className="no-data">No recent traffic logs available.</p>
        ) : (
          <div className="traffic-logs-table-wrapper">
            <table className="traffic-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Page Path</th>
                  <th>Viewer Email</th>
                  <th>Subscribed</th>
                </tr>
              </thead>
              <tbody>
                {trafficLogs.slice(0, 10).map((log) => ( // Show top 10 recent logs
                  <tr key={log.id}>
                    <td>{new Date(log.visited_at).toLocaleString()}</td>
                    <td>{log.page_path}</td>
                    <td>{log.viewer_email || 'Anonymous'}</td>
                    <td>{log.is_subscribed ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminTrafficPage;
