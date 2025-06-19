import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Bell, Building, Search, Target } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Job {
  id: string;
  company: string;
  position: string;
  status: 'applied' | 'interviewing' | 'offered' | 'rejected';
  created_at: string;
}

interface TrackedCompany {
  id: string;
  company_name: string;
  career_page_url: string;
  created_at: string;
}

interface Keyword {
  id: string;
  keyword: string;
  created_at: string;
}

interface Notification {
  id: string;
  job_id: string;
  keyword_matched: string;
  sent_at: string;
  email_sent: boolean;
  jobs: {
    company: string;
    position: string;
  };
}

const Dashboard = ({ user }: { user: User }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [trackedCompanies, setTrackedCompanies] = useState<TrackedCompany[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  
  const [newJob, setNewJob] = useState({
    company: '',
    position: '',
    status: 'applied' as const,
  });
  
  const [newCompany, setNewCompany] = useState({
    company_name: '',
    career_page_url: '',
  });
  
  const [newKeyword, setNewKeyword] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchJobs(),
        fetchTrackedCompanies(),
        fetchKeywords(),
        fetchNotifications(),
      ]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setJobs(data || []);
  };

  const fetchTrackedCompanies = async () => {
    const { data, error } = await supabase
      .from('tracked_companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setTrackedCompanies(data || []);
  };

  const fetchKeywords = async () => {
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setKeywords(data || []);
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        jobs!inner(company, position)
      `)
      .order('sent_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    setNotifications(data || []);
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('jobs').insert([
        {
          ...newJob,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Job added successfully!',
      });

      setNewJob({
        company: '',
        position: '',
        status: 'applied',
      });

      fetchJobs();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('tracked_companies').insert([
        {
          ...newCompany,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company added for tracking!',
      });

      setNewCompany({
        company_name: '',
        career_page_url: '',
      });

      fetchTrackedCompanies();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      const { error } = await supabase.from('keywords').insert([
        {
          keyword: newKeyword.trim(),
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Keyword added successfully!',
      });

      setNewKeyword('');
      fetchKeywords();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tracked_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Company removed from tracking',
      });

      fetchTrackedCompanies();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      const { error } = await supabase
        .from('keywords')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Keyword removed',
      });

      fetchKeywords();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleManualScrape = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('job-scraper', {
        body: { manual: true }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Scraping completed! Found ${data?.stats?.new_jobs_found || 0} new jobs`,
      });

      // Refresh data
      fetchAllData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to run scraper',
        variant: 'destructive',
      });
    } finally {
      setScraping(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your job tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Hunter Alert</h1>
            <p className="text-gray-600">Track jobs, get notified when opportunities match your keywords</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={handleManualScrape} 
              disabled={scraping}
              className="bg-green-600 hover:bg-green-700"
            >
              <Search className="w-4 h-4 mr-2" />
              {scraping ? 'Scraping...' : 'Run Scraper'}
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Building className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Tracked Companies</p>
                  <p className="text-2xl font-bold text-gray-900">{trackedCompanies.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Search className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Keywords</p>
                  <p className="text-2xl font-bold text-gray-900">{keywords.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Bell className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Notifications</p>
                  <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="jobs">My Jobs</TabsTrigger>
            <TabsTrigger value="companies">Tracked Companies</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add New Job Application
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddJob} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={newJob.company}
                        onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                        placeholder="Enter company name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={newJob.position}
                        onChange={(e) => setNewJob({ ...newJob, position: e.target.value })}
                        placeholder="Enter job title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={newJob.status}
                        onValueChange={(value: 'applied' | 'interviewing' | 'offered' | 'rejected') =>
                          setNewJob({ ...newJob, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="applied">Applied</SelectItem>
                          <SelectItem value="interviewing">Interviewing</SelectItem>
                          <SelectItem value="offered">Offered</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    Add Job
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {jobs.map((job) => (
                <Card key={job.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{job.position}</h3>
                        <p className="text-gray-600">{job.company}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Applied on {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge
                        variant={
                          job.status === 'offered'
                            ? 'default'
                            : job.status === 'interviewing'
                            ? 'secondary'
                            : job.status === 'rejected'
                            ? 'destructive'
                            : 'outline'
                        }
                        className={
                          job.status === 'offered'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : job.status === 'interviewing'
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : job.status === 'rejected'
                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }
                      >
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Track New Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCompany} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        value={newCompany.company_name}
                        onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                        placeholder="e.g., Google, Microsoft"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="career_page_url">Career Page URL</Label>
                      <Input
                        id="career_page_url"
                        type="url"
                        value={newCompany.career_page_url}
                        onChange={(e) => setNewCompany({ ...newCompany, career_page_url: e.target.value })}
                        placeholder="https://careers.company.com"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    Start Tracking
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {trackedCompanies.map((company) => (
                <Card key={company.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{company.company_name}</h3>
                        <a 
                          href={company.career_page_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          {company.career_page_url}
                        </a>
                        <p className="text-sm text-gray-500 mt-1">
                          Added on {new Date(company.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCompany(company.id)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Add Job Keywords
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddKeyword} className="flex gap-4">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g., Software Engineer, Data Scientist, Product Manager"
                    className="flex-1"
                  />
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                    Add Keyword
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              {keywords.map((keyword) => (
                <Badge
                  key={keyword.id}
                  variant="secondary"
                  className="px-4 py-2 text-sm bg-white/80 backdrop-blur-sm border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                >
                  {keyword.keyword}
                  <button
                    onClick={() => handleDeleteKeyword(keyword.id)}
                    className="ml-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="grid gap-4">
              {notifications.map((notification) => (
                <Card key={notification.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Bell className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            New job match: {notification.jobs.position}
                          </h3>
                          <p className="text-gray-600">at {notification.jobs.company}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Matched keyword: "{notification.keyword_matched}"
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notification.sent_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={notification.email_sent ? "default" : "secondary"}>
                        {notification.email_sent ? "Email Sent" : "Pending"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {notifications.length === 0 && (
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-12 text-center">
                    <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications yet</h3>
                    <p className="text-gray-600">
                      Add some companies and keywords to start receiving job match notifications!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;