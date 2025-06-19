import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
    
    // Enhanced job extraction patterns
    const jobTitlePatterns = [
      // Common job title patterns in HTML
      /<h[1-6][^>]*class="[^"]*job[^"]*title[^"]*"[^>]*>([^<]+)<\/h[1-6]>/gi,
      /<[^>]*class="[^"]*position[^"]*"[^>]*>([^<]+)</gi,
      /<[^>]*data-job-title="([^"]+)"/gi,
      /<[^>]*title="([^"]*(?:engineer|developer|scientist|analyst|manager|lead|senior|junior|intern|designer|architect|specialist|coordinator|director)[^"]*)"/gi,
      // JSON-LD structured data
      /"title"\s*:\s*"([^"]*(?:engineer|developer|scientist|analyst|manager|lead|senior|junior|intern|designer|architect|specialist|coordinator|director)[^"]*)"/gi,
      // Common career page patterns
      /job[_-]?title["\s]*[:=]["\s]*([^"<>\n]+)/gi,
      // Text patterns for job titles
      /(?:position|role|job|title):\s*([^\n<>]{10,80}(?:engineer|developer|scientist|analyst|manager|lead|senior|junior|intern|designer|architect|specialist|coordinator|director)[^\n<>]*)/gi
    ];
    
    const urlPatterns = [
      /href="([^"]*(?:job|career|position|apply)[^"]*)/gi,
      /"url"\s*:\s*"([^"]+)"/gi,
      /data-job-url="([^"]+)"/gi
    ];
    
    // Split HTML into manageable chunks for processing
    const chunks = html.match(/.{1,5000}/g) || [html];
    
    for (const chunk of chunks) {
      for (const pattern of jobTitlePatterns) {
        let match;
        while ((match = pattern.exec(chunk)) !== null) {
          const title = match[1].trim().replace(/\s+/g, ' ');
          
          // Filter out invalid titles
          if (title.length > 10 && 
              title.length < 150 && 
              !title.includes('<') && 
              !title.includes('>') &&
              !title.toLowerCase().includes('cookie') &&
              !title.toLowerCase().includes('privacy') &&
              /[a-zA-Z]/.test(title)) {
            
            // Extract URL if present in the same context
            let jobUrl = '';
            const contextStart = Math.max(0, chunk.indexOf(match[0]) - 500);
            const contextEnd = Math.min(chunk.length, chunk.indexOf(match[0]) + match[0].length + 500);
            const context = chunk.substring(contextStart, contextEnd);
            
            for (const urlPattern of urlPatterns) {
              const urlMatch = urlPattern.exec(context);
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
    
    // Remove duplicates and sort by relevance
    const uniqueJobs = jobs.filter((job, index, self) => 
      index === self.findIndex(j => j.title.toLowerCase() === job.title.toLowerCase())
    ).slice(0, 50); // Limit to 50 jobs per company
    
    console.log(`Found ${uniqueJobs.length} unique jobs from ${url}`);
    return { jobs: uniqueJobs, success: true };
  } catch (error) {
    console.error('Scraping error:', error);
    return { jobs: [], success: false, error: error.message };
  }
}

async function checkKeywordMatch(jobTitle: string, keywords: string[]): Promise<string | null> {
  const titleLower = jobTitle.toLowerCase();
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    if (titleLower.includes(keywordLower)) {
      return keyword;
    }
  }
  return null;
}

async function sendNotificationEmail(userEmail: string, job: Job, keyword: string, companyName: string) {
  try {
    // For now, we'll just log the notification
    // In production, you would integrate with a service like Resend, SendGrid, etc.
    console.log(`📧 Email notification would be sent to ${userEmail}:`);
    console.log(`Subject: 🎯 New Job Match: ${job.title} at ${companyName}`);
    console.log(`Matched keyword: "${keyword}"`);
    console.log(`Job URL: ${job.url}`);
    
    // Simulate successful email sending
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
    console.log('🚀 Starting job scraping process...');
    
    // Get all tracked companies with user profiles
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
    
    console.log(`📊 Found ${companies?.length || 0} companies to scrape`);
    
    let totalNewJobs = 0;
    let totalNotifications = 0;
    const processedCompanies = [];
    
    for (const company of companies || []) {
      console.log(`🏢 Processing ${company.company_name}...`);
      
      try {
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
          console.log(`⚠️ No keywords for user ${company.user_id}, skipping...`);
          continue;
        }
        
        // Scrape the company's career page
        const scrapedData = await scrapeJobPage(company.career_page_url);
        
        if (!scrapedData.success) {
          console.error(`❌ Failed to scrape ${company.company_name}: ${scrapedData.error}`);
          processedCompanies.push({
            company: company.company_name,
            success: false,
            error: scrapedData.error,
            jobs_found: 0
          });
          continue;
        }
        
        let companyNewJobs = 0;
        let companyNotifications = 0;
        
        // Process each job
        for (const job of scrapedData.jobs) {
          // Check if job already exists (simple check by title and company)
          const { data: existingJob } = await supabase
            .from('jobs')
            .select('id')
            .eq('user_id', company.user_id)
            .eq('company', company.company_name)
            .eq('position', job.title)
            .single();
          
          if (existingJob) {
            continue; // Job already exists
          }
          
          // Insert new job with 'applied' status as default for scraped jobs
          const { data: newJob, error: jobError } = await supabase
            .from('jobs')
            .insert({
              user_id: company.user_id,
              company: company.company_name,
              position: job.title,
              status: 'applied' // Default status for scraped jobs
            })
            .select('id')
            .single();
          
          if (jobError) {
            console.error('Error inserting job:', jobError);
            continue;
          }
          
          companyNewJobs++;
          console.log(`✅ Added new job: ${job.title}`);
          
          // Check for keyword matches
          const matchedKeyword = await checkKeywordMatch(job.title, keywordList);
          
          if (matchedKeyword) {
            console.log(`🎯 Keyword match found: "${matchedKeyword}" in "${job.title}"`);
            
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
                companyNotifications++;
              }
            }
          }
        }
        
        totalNewJobs += companyNewJobs;
        totalNotifications += companyNotifications;
        
        processedCompanies.push({
          company: company.company_name,
          success: true,
          jobs_found: companyNewJobs,
          notifications_sent: companyNotifications
        });
        
        console.log(`✨ ${company.company_name}: ${companyNewJobs} new jobs, ${companyNotifications} notifications`);
        
      } catch (error) {
        console.error(`Error processing ${company.company_name}:`, error);
        processedCompanies.push({
          company: company.company_name,
          success: false,
          error: error.message,
          jobs_found: 0
        });
      }
    }
    
    const result = {
      success: true,
      message: `Scraping completed successfully`,
      stats: {
        companies_processed: companies?.length || 0,
        new_jobs_found: totalNewJobs,
        notifications_sent: totalNotifications
      },
      details: processedCompanies
    };
    
    console.log('🎉 Scraping process completed:', result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
    
  } catch (error: any) {
    console.error('❌ Handler error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: 'Scraping process failed'
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