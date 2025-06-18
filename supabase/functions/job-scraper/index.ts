
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface Job {
  title: string;
  url?: string;
  description?: string;
  location?: string;
  posted_date?: string;
}

interface ScrapedData {
  jobs: Job[];
  success: boolean;
  error?: string;
}

async function scrapeJobPage(url: string): Promise<ScrapedData> {
  try {
    console.log(`Scraping URL: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const jobs: Job[] = [];
    
    // Simple text-based job extraction
    const lines = html.split('\n');
    const jobTitlePatterns = [
      /job[_-]?title["\s]*[:=]["\s]*([^"<>\n]+)/gi,
      /title["\s]*[:=]["\s]*([^"<>\n]+)/gi,
      /<h[1-6][^>]*>([^<]*(?:engineer|developer|scientist|analyst|manager|lead|senior|junior|intern)[^<]*)<\/h[1-6]>/gi,
      /class="[^"]*job[^"]*title[^"]*"[^>]*>([^<]+)</gi
    ];
    
    const urlPatterns = [
      /href="([^"]*(?:job|career|position)[^"]*)/gi,
      /url["\s]*[:=]["\s]*["]([^"]+)/gi
    ];
    
    for (const line of lines) {
      for (const pattern of jobTitlePatterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const title = match[1].trim();
          if (title.length > 5 && title.length < 100) {
            // Extract URL if present in the same context
            let jobUrl = '';
            for (const urlPattern of urlPatterns) {
              const urlMatch = urlPattern.exec(line);
              if (urlMatch) {
                jobUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : new URL(urlMatch[1], url).href;
                break;
              }
            }
            
            jobs.push({
              title,
              url: jobUrl || url,
              description: '',
              location: '',
              posted_date: new Date().toISOString()
            });
          }
        }
      }
    }
    
    // Remove duplicates
    const uniqueJobs = jobs.filter((job, index, self) => 
      index === self.findIndex(j => j.title === job.title)
    );
    
    console.log(`Found ${uniqueJobs.length} unique jobs`);
    return { jobs: uniqueJobs, success: true };
  } catch (error) {
    console.error('Scraping error:', error);
    return { jobs: [], success: false, error: error.message };
  }
}

async function checkKeywordMatch(jobTitle: string, keywords: string[]): Promise<string | null> {
  const titleLower = jobTitle.toLowerCase();
  for (const keyword of keywords) {
    if (titleLower.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  return null;
}

async function sendNotificationEmail(userEmail: string, job: Job, keyword: string, companyName: string) {
  try {
    const { error } = await resend.emails.send({
      from: 'Job Tracker <noreply@resend.dev>',
      to: [userEmail],
      subject: `🎯 New Job Match: ${job.title} at ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Job Match Found!</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">${job.title}</h3>
            <p><strong>Company:</strong> ${companyName}</p>
            <p><strong>Matched Keyword:</strong> "${keyword}"</p>
            ${job.location ? `<p><strong>Location:</strong> ${job.location}</p>` : ''}
            ${job.url ? `<p><a href="${job.url}" style="color: #2563eb; text-decoration: none;">View Job Posting →</a></p>` : ''}
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This notification was sent because the job title matches one of your tracked keywords.
          </p>
        </div>
      `
    });
    
    if (error) {
      console.error('Email sending error:', error);
      return false;
    }
    
    console.log('Email sent successfully');
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting job scraping process...');
    
    // Get all tracked companies
    const { data: companies, error: companiesError } = await supabase
      .from('tracked_companies')
      .select(`
        id,
        company_name,
        career_page_url,
        user_id,
        profiles!tracked_companies_user_id_fkey(email)
      `);
    
    if (companiesError) {
      throw companiesError;
    }
    
    console.log(`Found ${companies?.length || 0} companies to scrape`);
    
    let totalNewJobs = 0;
    let totalNotifications = 0;
    
    for (const company of companies || []) {
      console.log(`Processing ${company.company_name}...`);
      
      // Get user's keywords
      const { data: keywords, error: keywordsError } = await supabase
        .from('keywords')
        .select('keyword')
        .eq('user_id', company.user_id);
      
      if (keywordsError) {
        console.error('Error fetching keywords:', keywordsError);
        continue;
      }
      
      const keywordList = keywords?.map(k => k.keyword) || [];
      if (keywordList.length === 0) {
        console.log(`No keywords for user ${company.user_id}, skipping...`);
        continue;
      }
      
      // Scrape the company's career page
      const scrapedData = await scrapeJobPage(company.career_page_url);
      
      if (!scrapedData.success) {
        console.error(`Failed to scrape ${company.company_name}: ${scrapedData.error}`);
        continue;
      }
      
      // Process each job
      for (const job of scrapedData.jobs) {
        // Check if job already exists
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('id')
          .eq('company_id', company.id)
          .eq('title', job.title)
          .single();
        
        if (existingJob) {
          continue; // Job already exists
        }
        
        // Insert new job
        const { data: newJob, error: jobError } = await supabase
          .from('jobs')
          .insert({
            company_id: company.id,
            title: job.title,
            url: job.url,
            description: job.description,
            location: job.location,
            posted_date: job.posted_date,
            is_new: true
          })
          .select('id')
          .single();
        
        if (jobError) {
          console.error('Error inserting job:', jobError);
          continue;
        }
        
        totalNewJobs++;
        console.log(`Added new job: ${job.title}`);
        
        // Check for keyword matches
        const matchedKeyword = await checkKeywordMatch(job.title, keywordList);
        
        if (matchedKeyword) {
          console.log(`Keyword match found: "${matchedKeyword}" in "${job.title}"`);
          
          // Send email notification
          const userEmail = company.profiles?.email;
          if (userEmail) {
            const emailSent = await sendNotificationEmail(
              userEmail,
              job,
              matchedKeyword,
              company.company_name
            );
            
            // Record notification
            const { error: notificationError } = await supabase
              .from('notifications')
              .insert({
                user_id: company.user_id,
                job_id: newJob.id,
                keyword_matched: matchedKeyword,
                email_sent: emailSent
              });
            
            if (notificationError) {
              console.error('Error recording notification:', notificationError);
            } else {
              totalNotifications++;
            }
          }
        }
      }
    }
    
    const result = {
      success: true,
      message: `Scraping completed successfully`,
      stats: {
        companies_processed: companies?.length || 0,
        new_jobs_found: totalNewJobs,
        notifications_sent: totalNotifications
      }
    };
    
    console.log('Scraping process completed:', result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
    
  } catch (error: any) {
    console.error('Handler error:', error);
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
