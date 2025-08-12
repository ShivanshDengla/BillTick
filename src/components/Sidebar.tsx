import React from 'react';

type Project = {
  id: number;
  name: string;
  running: boolean;
};

type SidebarProps = {
  projects: Project[];
  projectColors: string[];
  onProjectClick: (projectId: number) => void;
};

export default function Sidebar({ projects, projectColors, onProjectClick }: SidebarProps) {
  const runningProjects = projects.filter((p) => p.running);

  return (
    <aside className="fixed left-0 top-0 h-full bg-gray-800 text-white w-16 flex flex-col items-center py-6 gap-4">
      <div className="text-lg font-bold">B</div>
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
  );
} 