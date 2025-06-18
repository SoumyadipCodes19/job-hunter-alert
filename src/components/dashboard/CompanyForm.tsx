
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

const CompanyForm = () => {
  const [companyName, setCompanyName] = useState('');
  const [careerUrl, setCareerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies, isLoading } = useQuery({
    queryKey: ['tracked-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracked_companies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('tracked_companies')
        .insert({
          user_id: user.id,
          company_name: companyName,
          career_page_url: careerUrl,
        });

      if (error) throw error;

      toast({ title: "Company added successfully!" });
      setCompanyName('');
      setCareerUrl('');
      queryClient.invalidateQueries({ queryKey: ['tracked-companies'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tracked_companies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Company removed successfully!" });
      queryClient.invalidateQueries({ queryKey: ['tracked-companies'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Company Career Pages</CardTitle>
        <CardDescription>
          Add company career page URLs to monitor for new job postings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Company Name (e.g., Google)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              type="url"
              placeholder="Career Page URL (e.g., https://careers.google.com/jobs/)"
              value={careerUrl}
              onChange={(e) => setCareerUrl(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Adding...' : 'Add Company'}
          </Button>
        </form>

        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">Tracked Companies</h3>
          {isLoading ? (
            <p className="text-gray-500">Loading companies...</p>
          ) : companies && companies.length > 0 ? (
            <div className="space-y-2">
              {companies.map((company) => (
                <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{company.company_name}</p>
                    <p className="text-sm text-gray-600">{company.career_page_url}</p>
                  </div>
                  <Button
                    onClick={() => handleDelete(company.id)}
                    variant="ghost"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No companies tracked yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyForm;
