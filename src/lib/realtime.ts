import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

class RealtimeService {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private static instance: RealtimeService;

  private constructor() {
    this.supabase = supabase;
  }

  // Singleton pattern to ensure one instance
  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  // Unsubscribe from a specific channel
  public unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      console.log(`🔌 Unsubscribed from ${channelName}`);
    }
  }

  // Unsubscribe from all channels
  public unsubscribeAll(): void {
    this.channels.forEach((channel, name) => {
      channel.unsubscribe();
      console.log(`🔌 Unsubscribed from ${name}`);
    });
    this.channels.clear();
  }
}

export const realtimeService = RealtimeService.getInstance();