
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Scheduler triggered, invoking job scraper...');
    
    // Call the job scraper function
    const { data, error } = await supabase.functions.invoke('job-scraper', {
      body: { 
        scheduled: true, 
        timestamp: new Date().toISOString() 
      }
    });
    
    if (error) {
      throw error;
    }
    
    console.log('Job scraper completed:', data);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Scheduled scraping completed',
      scraper_result: data
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
    
  } catch (error: any) {
    console.error('Scheduler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
