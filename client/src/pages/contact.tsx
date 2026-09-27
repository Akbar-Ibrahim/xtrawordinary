import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { contactMessageInputSchema, type ContactMessageInput } from "@shared/schema";
import { PageSEO } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

const emptyForm: ContactMessageInput = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

export default function Contact() {
  const [sent, setSent] = useState(false);
  const form = useForm<ContactMessageInput>({
    resolver: zodResolver(contactMessageInputSchema),
    defaultValues: emptyForm,
  });

  const submitMutation = useMutation({
    mutationFn: (values: ContactMessageInput) => apiRequest("POST", "/api/contact", values),
    onSuccess: () => {
      form.reset(emptyForm);
      setSent(true);
    },
    onError: () => {
      form.setError("root", {
        message: "We could not send your message. Please wait a moment and try again.",
      });
    },
  });

  const messageLength = form.watch("message")?.length ?? 0;

  return (
    <>
      <PageSEO
        title="Contact Us"
        description="Send a message to the xtraWordinary team."
        path="/contact"
      />
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Get in touch</h1>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                Have a question, suggestion, or issue to report? Send us a message and we’ll review it as soon as we can.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Fields marked with an asterisk are required. Your contact details are used only to review and respond to your message.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{sent ? "Message received" : "Send us a message"}</CardTitle>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="py-8 text-center" role="status" data-testid="contact-success">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                  <h2 className="mt-4 text-xl font-semibold">Thanks for contacting us</h2>
                  <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                    Your message has been sent to the team.
                  </p>
                  <Button className="mt-6" variant="outline" onClick={() => setSent(false)}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((values) => submitMutation.mutate(values))} className="space-y-5" noValidate>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name *</FormLabel>
                            <FormControl><Input autoComplete="name" maxLength={120} {...field} data-testid="input-contact-name" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email address *</FormLabel>
                            <FormControl><Input type="email" autoComplete="email" maxLength={255} {...field} data-testid="input-contact-email" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                          <FormControl><Input maxLength={160} {...field} data-testid="input-contact-subject" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-3">
                            <FormLabel>Message *</FormLabel>
                            <span className="text-xs text-muted-foreground">{messageLength.toLocaleString()}/5,000</span>
                          </div>
                          <FormControl>
                            <Textarea className="min-h-44 resize-y" maxLength={5000} {...field} data-testid="input-contact-message" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                      <label htmlFor="contact-website">Website</label>
                      <input
                        id="contact-website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        {...form.register("website")}
                      />
                    </div>
                    {form.formState.errors.root?.message && (
                      <p className="text-sm font-medium text-destructive" role="alert">
                        {form.formState.errors.root.message}
                      </p>
                    )}
                    <Button type="submit" className="w-full sm:w-auto" disabled={submitMutation.isPending} data-testid="button-contact-submit">
                      {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send message
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}