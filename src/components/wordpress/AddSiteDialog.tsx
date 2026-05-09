import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const addSiteSchema = z.object({
  label: z.string().min(1, 'Názov je povinný'),
  base_url: z.string().url('Platná URL je povinná'),
  site_type: z.enum(['com', 'self']),
  username: z.string().optional(),
  app_password: z.string().optional(),
});

type AddSiteForm = z.infer<typeof addSiteSchema>;

export default function AddSiteDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm<AddSiteForm>({
    resolver: zodResolver(addSiteSchema),
    defaultValues: {
      label: '',
      base_url: '',
      site_type: 'com',
      username: '',
      app_password: '',
    },
  });

  const siteType = form.watch('site_type');

  const onSubmit = async (data: AddSiteForm) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nie ste prihlásený');

      const insertData: any = {
        user_id: user.id,
        label: data.label,
        base_url: data.base_url.endsWith('/') 
          ? data.base_url.slice(0, -1) 
          : data.base_url,
        site_type: data.site_type,
      };

      if (data.site_type === 'self') {
        if (!data.username || !data.app_password) {
          throw new Error('Username a Application Password sú povinné');
        }
        insertData.username = data.username;
        insertData.app_password_encrypted = btoa(data.app_password);
      }

      const { error } = await supabase
        .from('wp_sites')
        .insert([insertData]);

      if (error) throw error;
      onSuccess();
      form.reset();
    } catch (err: any) {
      toast.error('Chyba pri pripojení', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pripojiť WordPress site</DialogTitle>
          <DialogDescription>
            Vyberte si typ WordPress a zadajte detaily pripojenia.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Názov lokality</FormLabel>
                  <FormControl>
                    <Input placeholder="Môj blog" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ WordPress</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="com">
                        📘 WordPress.com (spravovaný)
                      </SelectItem>
                      <SelectItem value="self">
                        🖥️ Self-hosted WordPress
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="base_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL stránky</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={
                        siteType === 'com'
                          ? 'https://example.wordpress.com'
                          : 'https://example.com'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {siteType === 'self' && (
              <>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WP Username</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} />
                      </FormControl>
                      <FormDescription>
                        Vytvorte "Application Password" v Users → Profil
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="app_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="xxxx xxxx xxxx xxxx" {...field} />
                      </FormControl>
                      <FormDescription>
                        Nikdy sa neukladá v prehliadači, iba šifrovaný na serveri
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Zrušiť
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Pripájam...' : 'Pripojiť'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}