import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Loader2, RotateCcw, Send } from 'lucide-react';
import {
  EMAIL_TEMPLATE_TYPES,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailTemplateType,
} from '@vibe/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import {
  useEmailTemplates,
  useUpdateEmailTemplate,
  useResetEmailTemplate,
  usePreviewEmailTemplate,
} from '@/hooks/use-email-templates';
import { useSendTestEmail } from '@/hooks/use-send-test-email';

// --- Email Provider Card ---

interface EmailProviderFormValues {
  emailProvider: string;
  resendApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecure: boolean;
}

function EmailProviderCard() {
  const { t } = useTranslation('settings');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<EmailProviderFormValues>();

  useEffect(() => {
    if (settings) {
      reset({
        emailProvider: (settings as any).emailProvider || 'resend',
        resendApiKey: (settings as any).resendApiKey || '',
        smtpHost: (settings as any).smtpHost || '',
        smtpPort: (settings as any).smtpPort || 587,
        smtpUsername: (settings as any).smtpUsername || '',
        smtpPassword: (settings as any).smtpPassword || '',
        smtpSecure: (settings as any).smtpSecure ?? true,
      });
    }
  }, [settings, reset]);

  if (isLoading) return <LoadingSpinner />;

  const provider = watch('emailProvider');

  const onSubmit = (data: EmailProviderFormValues) => {
    updateSettings.mutate(data as Record<string, unknown>);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('emailProvider')}</CardTitle>
        <CardDescription>{t('emailProviderDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value="resend"
                className="h-4 w-4"
                {...register('emailProvider')}
              />
              <span className="text-sm font-medium">{t('useResend')}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                value="smtp"
                className="h-4 w-4"
                {...register('emailProvider')}
              />
              <span className="text-sm font-medium">{t('useSmtp')}</span>
            </label>
          </div>

          {provider === 'resend' && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="resendApiKey">{t('resendApiKey')}</Label>
              <Input
                id="resendApiKey"
                type="password"
                placeholder={t('resendApiKeyPlaceholder')}
                {...register('resendApiKey')}
              />
              <p className="text-xs text-muted-foreground">
                {t('resendApiKeyHint')}
              </p>
            </div>
          )}

          {provider === 'smtp' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">{t('smtpHost')}</Label>
                  <Input
                    id="smtpHost"
                    placeholder={t('smtpHostPlaceholder')}
                    {...register('smtpHost')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">{t('smtpPort')}</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    min="1"
                    max="65535"
                    placeholder={t('smtpPortPlaceholder')}
                    {...register('smtpPort', { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpUsername">{t('smtpUsername')}</Label>
                  <Input
                    id="smtpUsername"
                    placeholder={t('smtpUsernamePlaceholder')}
                    {...register('smtpUsername')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">{t('smtpPassword')}</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    placeholder={t('smtpPasswordPlaceholder')}
                    {...register('smtpPassword')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  className="h-4 w-4 rounded border-gray-300"
                  {...register('smtpSecure')}
                />
                <div>
                  <Label htmlFor="smtpSecure">{t('smtpSecure')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('smtpSecureHint')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={!isDirty || updateSettings.isPending}
          >
            {updateSettings.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {t('saveEmailProvider')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// --- Email Templates Card ---

const TAB_LABELS: Record<EmailTemplateType, string> = {
  invoice: 'emailTemplateInvoice',
  quote: 'emailTemplateQuote',
  reminder: 'emailTemplateReminder',
};

function EmailTemplatesCard() {
  const { t } = useTranslation('settings');
  const { data: settings } = useSettings();
  const { data: templates, isLoading } = useEmailTemplates();
  const updateTemplate = useUpdateEmailTemplate();
  const resetTemplate = useResetEmailTemplate();
  const previewTemplate = usePreviewEmailTemplate();
  const sendTestEmail = useSendTestEmail();

  const [activeTab, setActiveTab] = useState<EmailTemplateType>('invoice');
  const [formState, setFormState] = useState<Record<EmailTemplateType, {
    subject: string; body: string; headerColor: string;
  }>>({
    invoice: { subject: '', body: '', headerColor: '#2563eb' },
    quote: { subject: '', body: '', headerColor: '#7c3aed' },
    reminder: { subject: '', body: '', headerColor: '#dc2626' },
  });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (templates && !initialized) {
      const state = { ...formState };
      for (const tpl of templates) {
        const type = tpl.type as EmailTemplateType;
        state[type] = {
          subject: tpl.subject,
          body: tpl.body,
          headerColor: tpl.headerColor || formState[type].headerColor,
        };
      }
      setFormState(state);
      setInitialized(true);
    }
  }, [templates, initialized]);

  useEffect(() => {
    if (settings?.businessEmail && !testEmail) {
      setTestEmail(settings.businessEmail);
    }
  }, [settings]);

  if (isLoading) return null;

  const current = formState[activeTab];
  const currentTpl = templates?.find((t) => t.type === activeTab);

  const handleSave = () => {
    updateTemplate.mutate({
      type: activeTab,
      data: {
        subject: current.subject,
        body: current.body,
        headerColor: current.headerColor,
      },
    });
  };

  const handleReset = () => {
    if (!confirm(t('emailResetConfirm'))) return;
    resetTemplate.mutate(activeTab, {
      onSuccess: () => setInitialized(false),
    });
  };

  const handlePreview = () => {
    const current = formState[activeTab];
    previewTemplate.mutate({
      type: activeTab,
      data: {
        subject: current.subject,
        body: current.body,
        headerColor: current.headerColor,
      },
    }, {
      onSuccess: (data) => setPreviewHtml(data.html),
    });
  };

  const handleSendTest = () => {
    if (!testEmail) return;
    sendTestEmail.mutate({ type: activeTab, to: testEmail });
  };

  const updateField = (
    field: 'subject' | 'body' | 'headerColor',
    value: string,
  ) => {
    setFormState((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: value },
    }));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('emailTemplates')}</CardTitle>
          <CardDescription>{t('emailTemplatesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as EmailTemplateType)}
          >
            <TabsList className="mb-4">
              {EMAIL_TEMPLATE_TYPES.map((type) => (
                <TabsTrigger key={type} value={type}>
                  {t(TAB_LABELS[type])}
                </TabsTrigger>
              ))}
            </TabsList>

            {EMAIL_TEMPLATE_TYPES.map((type) => (
              <TabsContent key={type} value={type} className="space-y-4">
                <div className="flex items-center gap-2">
                  {currentTpl?.isCustomized ? (
                    <Badge variant="secondary">{t('emailCustomized')}</Badge>
                  ) : (
                    <Badge variant="outline">{t('emailDefault')}</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('emailSubject')}</Label>
                  <Input
                    value={formState[type].subject}
                    onChange={(e) => updateField('subject', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('emailBody')}</Label>
                  <Textarea
                    rows={4}
                    value={formState[type].body}
                    onChange={(e) => updateField('body', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('emailHeaderColor')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formState[type].headerColor}
                      onChange={(e) => updateField('headerColor', e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border p-1"
                    />
                    <Input
                      value={formState[type].headerColor}
                      onChange={(e) => updateField('headerColor', e.target.value)}
                      className="w-28"
                      maxLength={7}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {t('emailAvailableVars')}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {EMAIL_TEMPLATE_VARIABLES[type].map((v) => (
                      <Badge key={v} variant="outline" className="font-mono text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={updateTemplate.isPending}
                  >
                    {updateTemplate.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {updateTemplate.isPending
                      ? t('emailSaving')
                      : t('emailSaveTemplate')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    disabled={previewTemplate.isPending}
                  >
                    {t('emailPreview')}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline">
                        <Send className="h-4 w-4" />
                        {t('sendTest')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">{t('sendTestTitle')}</h4>
                          <p className="text-xs text-muted-foreground">
                            {t('sendTestDesc')}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('recipientEmail')}</Label>
                          <Input
                            type="email"
                            placeholder={t('recipientEmailPlaceholder')}
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          onClick={handleSendTest}
                          disabled={!testEmail || sendTestEmail.isPending}
                        >
                          {sendTestEmail.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {t('sendTestButton')}
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleReset}
                    disabled={resetTemplate.isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('emailResetDefault')}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('emailPreview')}</DialogTitle>
          </DialogHeader>
          <iframe
            srcDoc={previewHtml || ''}
            className="h-[500px] w-full rounded border"
            sandbox=""
            title="Email Preview"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Main Email Settings Page ---

export function EmailSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <EmailProviderCard />
      <EmailTemplatesCard />
    </div>
  );
}
