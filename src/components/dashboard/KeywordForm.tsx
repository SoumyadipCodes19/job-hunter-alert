
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

const KeywordForm = () => {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: keywords, isLoading } = useQuery({
    queryKey: ['keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keywords')
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
        .from('keywords')
        .insert({
          user_id: user.id,
          keyword: keyword.trim(),
        });

      if (error) throw error;

      toast({ title: "Keyword added successfully!" });
      setKeyword('');
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
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
        .from('keywords')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Keyword removed successfully!" });
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
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
        <CardTitle>Job Title Keywords</CardTitle>
        <CardDescription>
          Add keywords to match against job titles (e.g., "SDE", "Data Scientist", "Frontend")
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter job keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">Your Keywords</h3>
          {isLoading ? (
            <p className="text-gray-500">Loading keywords...</p>
          ) : keywords && keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <Badge key={kw.id} variant="secondary" className="flex items-center gap-1">
                  {kw.keyword}
                  <button
                    onClick={() => handleDelete(kw.id)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No keywords added yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default KeywordForm;
