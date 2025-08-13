import { useState } from 'react';
import type { User } from '@supabase/supabase-js';

type Project = {
  id: number;
  name: string;
  running: boolean;
};

type SidebarProps = {
  projects: Project[];
  projectColors: string[];
  onProjectClick: (projectId: number) => void;
  user: User | null;
  onSignOut: () => void;
};

export default function Sidebar({ projects, projectColors, onProjectClick, user, onSignOut }: SidebarProps) {
  const runningProjects = projects.filter((p) => p.running);
  const [showProfile, setShowProfile] = useState(false);

  // Mock subscription tier - you can replace this with actual subscription data
  const subscriptionTier: 'free' | 'pro' | 'teams' = "free"; // This should come from your user data or subscription service

  return (
    <>
      <aside className="fixed left-0 top-0 h-full bg-gray-800 text-white w-20 flex flex-col items-center py-6 gap-4">
        {/* Profile Section - Clickable */}
        {user && (
          <button
            onClick={() => setShowProfile(true)}
            className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-lg font-bold hover:bg-blue-600 transition-colors cursor-pointer group"
            title="Click to view profile"
          >
            {user.user_metadata?.full_name ? 
              user.user_metadata.full_name.charAt(0).toUpperCase() : 
              user.email?.charAt(0).toUpperCase()
            }
          </button>
        )}
        
        <div className="flex flex-col gap-4 mt-8">
          {runningProjects.map((p) => {
            const projectIndex = projects.findIndex((proj) => proj.id === p.id);
            const colorClass = projectColors[projectIndex % projectColors.length];
            
            return (
              <button
                key={p.id}
                onClick={() => onProjectClick(p.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-md transition-transform hover:scale-110 ${colorClass}`}
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </button>
            );
          })}
        </div>
        {runningProjects.length > 0 && (
          <div className="mt-auto text-xs text-gray-400">
            {runningProjects.length} active
          </div>
        )}
      </aside>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
              <button
                onClick={() => setShowProfile(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Profile Picture */}
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                  {user?.user_metadata?.full_name ? 
                    user.user_metadata.full_name.charAt(0).toUpperCase() : 
                    user?.email?.charAt(0).toUpperCase()
                  }
                </div>
              </div>
              
              {/* User Details */}
              <div className="text-center">
                <h4 className="text-xl font-semibold text-gray-900">
                  {user?.user_metadata?.full_name || 'User'}
                </h4>
                <p className="text-gray-600 text-sm mt-1">
                  {user?.email}
                </p>
              </div>
              
              {/* Subscription Tier */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Subscription</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    subscriptionTier === 'free' ? 'bg-gray-100 text-gray-800' :
                    subscriptionTier === 'pro' ? 'bg-blue-100 text-blue-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {subscriptionTier === 'free' ? 'Basic features included' :
                   subscriptionTier === 'pro' ? 'Advanced features & priority support' :
                   'Team collaboration & admin tools'}
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  onClick={() => {
                    // Add upgrade logic here
                    console.log('Upgrade subscription');
                  }}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {subscriptionTier === 'free' ? 'Upgrade to Pro' : 'Manage Subscription'}
                </button>
                <button
                  onClick={onSignOut}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 