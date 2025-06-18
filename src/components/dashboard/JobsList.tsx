
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, MapPin, Calendar } from 'lucide-react';

const JobsList = () => {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          tracked_companies (company_name)
        `)
        .order('scraped_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Job Matches</CardTitle>
          <CardDescription>
            Jobs that match your keywords from tracked companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500">Loading jobs...</p>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {job.tracked_companies?.company_name}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        {job.location && (
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {job.location}
                          </div>
                        )}
                        {job.posted_date && (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(job.posted_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {job.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {job.description.substring(0, 150)}...
                        </p>
                      )}

                      {job.is_new && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          New
                        </Badge>
                      )}
                    </div>
                    
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No jobs found yet</p>
              <p className="text-sm text-gray-400">
                Jobs will appear here once the scraper finds matches for your keywords
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {notifications && notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
            <CardDescription>
              Email notifications sent for job matches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium">
                      Keyword match: "{notification.keyword_matched}"
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(notification.sent_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={notification.email_sent ? "default" : "secondary"}>
                    {notification.email_sent ? "Sent" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobsList;
