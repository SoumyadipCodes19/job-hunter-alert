
import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompanyForm from './CompanyForm';
import KeywordForm from './KeywordForm';
import JobsList from './JobsList';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

interface DashboardProps {
  user: User;
}

const Dashboard = ({ user }: DashboardProps) => {
  const { toast } = useToast();
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleManualScraping = async () => {
    setIsScrapingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('job-scraper');
      
      if (error) throw error;
      
      toast({
        title: "Scraping completed!",
        description: `Found ${data.stats?.new_jobs_found || 0} new jobs, sent ${data.stats?.notifications_sent || 0} notifications`,
      });
      
      // Refresh the jobs list
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Scraping failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsScrapingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleManualScraping} 
                disabled={isScrapingLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isScrapingLoading ? 'animate-spin' : ''}`} />
                {isScrapingLoading ? 'Scraping...' : 'Run Scraper'}
              </Button>
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button onClick={handleSignOut} variant="outline">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="setup" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">Setup Tracking</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="jobs">Job Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CompanyForm />
            </div>
          </TabsContent>

          <TabsContent value="keywords" className="space-y-6">
            <KeywordForm />
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <JobsList />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
