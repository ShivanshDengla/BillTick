import { supabase } from './supabase';

export type Project = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type Timer = {
  id: string;
  project_id: string;
  start_time: string;
  end_time: string | null;
  is_running: boolean;
  created_at: string;
};

// Projects API
export const projectsApi = {
  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async createProject(name: string, color: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name, color }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Timers API
export const timersApi = {
  async getTimers(projectId?: string): Promise<Timer[]> {
    let query = supabase.from('timers').select('*');
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async startTimer(projectId: string): Promise<Timer> {
    const { data, error } = await supabase
      .from('timers')
      .insert([{ 
        project_id: projectId, 
        start_time: new Date().toISOString(),
        is_running: true 
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async stopTimer(timerId: string): Promise<Timer> {
    const { data, error } = await supabase
      .from('timers')
      .update({ 
        end_time: new Date().toISOString(),
        is_running: false 
      })
      .eq('id', timerId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};