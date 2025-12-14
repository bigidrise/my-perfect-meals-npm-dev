import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const response = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      setEmailSent(true);
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    forgotPasswordMutation.mutate(data);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
        <div className="relative isolate w-full max-w-sm rounded-2xl p-8
                        bg-black/25 backdrop-blur-xl border border-white/10 shadow-xl text-center">
          <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                           bg-gradient-to-br from-white/10 via-transparent to-transparent" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 p-3 rounded-full bg-green-500/20">
              <CheckCircle className="h-12 w-12 text-green-400" data-testid="icon-success" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
            
            <p className="text-sm text-white/85 mb-6">
              If that email exists in our system, we've sent you a password reset link. 
              Please check your inbox and spam folder.
            </p>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 w-full">
              <p className="text-xs text-blue-300">
                <strong>Note:</strong> The link will expire in 30 minutes for security reasons.
              </p>
            </div>

            <Button
              onClick={() => setLocation("/auth")}
              className="w-full bg-black/40 backdrop-blur-md border border-white/10
                         text-white shadow-md hover:bg-black/50 transition"
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
      <div className="relative isolate w-full max-w-sm rounded-2xl p-6
                      bg-black/25 backdrop-blur-xl border border-white/10 shadow-xl">
        <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                         bg-gradient-to-br from-white/10 via-transparent to-transparent" />

        <div className="relative z-10">
          <Button
            variant="ghost"
            onClick={() => setLocation("/auth")}
            className="mb-4 text-white/70 hover:text-white hover:bg-white/10 p-2"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center justify-center mb-6">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Mail className="h-8 w-8 text-purple-400" data-testid="icon-mail" />
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1 text-center">Forgot Password?</h1>
          <p className="text-sm text-white/85 mb-6 text-center">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        className="bg-white/10 border-white/20 text-white placeholder-white/60
                                   focus:ring-2 focus:ring-white/30 focus:border-white/30"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-300" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10
                           text-white shadow-md hover:bg-black/50 transition disabled:opacity-50"
                data-testid="button-send-reset-link"
              >
                {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
              </Button>

              {forgotPasswordMutation.isError && (
                <div className="text-sm text-red-300 text-center" data-testid="text-error">
                  An error occurred. Please try again later.
                </div>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
