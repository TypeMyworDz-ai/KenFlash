import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './MyViewsPage.css';

function MyViewsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Summary stats
  const [totalViews, setTotalViews] = useState(0);
  const [viewsThisMonth, setViewsThisMonth] = useState(0);
  const [viewsThisWeek, setViewsThisWeek] = useState(0);
  const [viewsToday, setViewsToday] = useState(0);
  
  // Breakdown stats
  const [photoViews, setPhotoViews] = useState(0);
  const [videoViews, setVideoViews] = useState(0);
  
  // Detailed data
  const [dailyViews, setDailyViews] = useState([]);
  const [monthlyViews, setMonthlyViews] = useState([]);
  const [topContent, setTopContent] = useState([]);

  useEffect(() => {
    const fetchViewsData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        navigate('/login');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();


        // UPDATED: Fetch all views for this creator directly from the 'views' table
        // RLS policy on 'views' table already filters by auth.uid() = creator_id
        const { data: creatorViews, error: viewsError } = await supabase
          .from('views')
          .select(`
            content_id,
            viewed_at,
            creator_id,
            content_type
          `);

        if (viewsError) throw viewsError;

        // No need for client-side filtering by creator_id anymore, RLS handles it.
        // The data already comes filtered for the current authUser.id
        const filteredViews = creatorViews || [];

        // Process the filtered views data
        let totalCount = 0;
        let todayCount = 0;
        let weekCount = 0;
        let monthCount = 0;
        let photoCount = 0;
        let videoCount = 0;

        const dailyBreakdown = {};
        const monthlyBreakdown = {};
        const contentViewCount = {};

        filteredViews.forEach(view => {
          totalCount++;

          const viewDate = new Date(view.viewed_at);

          // Time-based counts
          if (viewDate.toISOString() >= todayStart) todayCount++;
          if (viewDate.toISOString() >= weekStart) weekCount++;
          if (viewDate.toISOString() >= monthStart) monthCount++;

          // Content type breakdown (now directly from view.content_type)
          if (view.content_type === 'photo') photoCount++;
          if (view.content_type === 'video') videoCount++;

          // Daily views (last 30 days)
          if (viewDate.toISOString() >= thirtyDaysAgo) {
            const dateKey = viewDate.toLocaleDateString();
            dailyBreakdown[dateKey] = (dailyBreakdown[dateKey] || 0) + 1;
          }

          // Monthly views (all-time)
          const monthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
          monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + 1;

          // Top performing content (now directly from view.content_type)
          const contentKey = `${view.content_type}-${view.content_id}`;
          contentViewCount[contentKey] = (contentViewCount[contentKey] || 0) + 1;
        });

        setTotalViews(totalCount);
        setViewsToday(todayCount);
        setViewsThisWeek(weekCount);
        setViewsThisMonth(monthCount);
        setPhotoViews(photoCount);
        setVideoViews(videoCount);

        setDailyViews(Object.entries(dailyBreakdown).map(([date, count]) => ({ date, count })).sort((a, b) => new Date(a.date) - new Date(b.date)));
        setMonthlyViews(Object.entries(monthlyBreakdown).map(([month, count]) => ({ month, count })).sort());

        const topContentList = Object.entries(contentViewCount)
          .map(([key, count]) => {
            const [type, id] = key.split('-');
            return { id, type, count };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopContent(topContentList);


      } catch (err) {
        setError(err.message || 'Failed to fetch views data');
        console.error('Error fetching views:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchViewsData();
  }, [navigate]);

  if (loading) {
    return <div className="my-views-container"><p>Loading views data...</p></div>;
  }

  if (error) {
    return <div className="my-views-container"><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="my-views-container">
      <h2>My Views</h2>
      <p>Monitor your content's performance and track your total views.</p>

      {/* Summary Cards */}
      <div className="views-stats-grid">
        <div className="views-card">
          <h3>Total Views</h3>
          <p className="views-number">{totalViews.toLocaleString()}</p>
          <p className="views-description">All-time views across all content</p>
        </div>

        <div className="views-card">
          <h3>Views This Month</h3>
          <p className="views-number">{viewsThisMonth.toLocaleString()}</p>
          <p className="views-description">Views accumulated this month</p>
        </div>

        <div className="views-card">
          <h3>Views This Week</h3>
          <p className="views-number">{viewsThisWeek.toLocaleString()}</p>
          <p className="views-description">Views in the last 7 days</p>
        </div>

        <div className="views-card">
          <h3>Views Today</h3>
          <p className="views-number">{viewsToday.toLocaleString()}</p>
          <p className="views-description">Views accumulated today</p>
        </div>
      </div>

      {/* Content Type Breakdown */}
      <div className="views-breakdown-section">
        <h3>Views by Content Type</h3>
        <div className="breakdown-grid">
          <div className="breakdown-card">
            <h4>📸 Photo Views</h4>
            <p className="breakdown-number">{photoViews.toLocaleString()}</p>
            <p className="breakdown-percentage">{totalViews > 0 ? ((photoViews / totalViews) * 100).toFixed(1) : 0}% of total</p>
          </div>
          <div className="breakdown-card">
            <h4>🎥 Video Views</h4>
            <p className="breakdown-number">{videoViews.toLocaleString()}</p>
            <p className="breakdown-percentage">{totalViews > 0 ? ((videoViews / totalViews) * 100).toFixed(1) : 0}% of total</p>
          </div>
        </div>
      </div>

      {/* Monthly Views */}
      <div className="views-chart-section">
        <h3>Views Per Month (All-Time)</h3>
        {monthlyViews.length > 0 ? (
          <div className="views-table-wrapper">
            <table className="views-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {monthlyViews.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.month}</td>
                    <td>{item.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No monthly data available</p>
        )}
      </div>

      {/* Daily Views Last 30 Days */}
      <div className="views-chart-section">
        <h3>Views Per Day (Last 30 Days)</h3>
        {dailyViews.length > 0 ? (
          <div className="views-table-wrapper">
            <table className="views-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {dailyViews.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.date}</td>
                    <td>{item.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No daily data available</p>
        )}
      </div>

      {/* Top Performing Content */}
      <div className="views-chart-section">
        <h3>Top Performing Content</h3>
        {topContent.length > 0 ? (
          <div className="views-table-wrapper">
            <table className="views-table">
              <thead>
                <tr>
                  <th>Content Type</th>
                  <th>Content ID</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.type === 'photo' ? '📸 Photo' : '🎥 Video'}</td>
                    <td>{item.id.substring(0, 8)}...</td>
                    <td>{item.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No content views yet</p>
        )}
      </div>

      <p className="views-footer">Keep creating amazing content to grow your audience!</p>
    </div>
  );
}

export default MyViewsPage;
