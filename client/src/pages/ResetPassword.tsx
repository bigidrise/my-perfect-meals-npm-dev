import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Extract token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    setToken(tokenParam);
  }, []);

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      if (!token) {
        throw new Error("No reset token found");
      }

      const response = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });
      return response;
    },
    onSuccess: () => {
      setResetSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/auth");
      }, 3000);
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    resetPasswordMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
        <div className="relative isolate w-full max-w-sm rounded-2xl p-8
                        bg-black/25 backdrop-blur-xl border border-white/10 shadow-xl text-center">
          <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                           bg-gradient-to-br from-white/10 via-transparent to-transparent" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 p-3 rounded-full bg-red-500/20">
              <AlertCircle className="h-12 w-12 text-red-400" data-testid="icon-error" />
            </div>

            <h1 className="text-2xl font-bold mb-2">Invalid Reset Link</h1>
            
            <p className="text-sm text-white/85 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>

            <Button
              onClick={() => setLocation("/forgot-password")}
              className="w-full bg-black/40 backdrop-blur-md border border-white/10
                         text-white shadow-md hover:bg-black/50 transition"
              data-testid="button-request-new-link"
            >
              Request New Link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
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

            <h1 className="text-2xl font-bold mb-2">Password Reset Successful!</h1>
            
            <p className="text-sm text-white/85 mb-4">
              Your password has been successfully reset.
            </p>

            <p className="text-xs text-white/70 mb-6">
              Redirecting to login in 3 seconds...
            </p>

            <Button
              onClick={() => setLocation("/auth")}
              className="w-full bg-black/40 backdrop-blur-md border border-white/10
                         text-white shadow-md hover:bg-black/50 transition"
              data-testid="button-go-to-login"
            >
              Go to Login Now
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
          <div className="flex items-center justify-center mb-6">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Lock className="h-8 w-8 text-purple-400" data-testid="icon-lock" />
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1 text-center">Set New Password</h1>
          <p className="text-sm text-white/85 mb-6 text-center">
            Choose a strong password for your account.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          className="bg-white/10 border-white/20 text-white placeholder-white/60
                                     focus:ring-2 focus:ring-white/30 focus:border-white/30 pr-12"
                          autoCorrect="off"
                          autoCapitalize="off"
                          data-testid="input-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onPointerDown={() => setShowPassword(true)}
                          onPointerUp={() => setShowPassword(false)}
                          onPointerLeave={() => setShowPassword(false)}
                          onContextMenu={(e) => e.preventDefault()}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 touch-none select-none"
                          aria-label="Hold to show password"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-300" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          className="bg-white/10 border-white/20 text-white placeholder-white/60
                                     focus:ring-2 focus:ring-white/30 focus:border-white/30 pr-12"
                          autoCorrect="off"
                          autoCapitalize="off"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onPointerDown={() => setShowConfirmPassword(true)}
                          onPointerUp={() => setShowConfirmPassword(false)}
                          onPointerLeave={() => setShowConfirmPassword(false)}
                          onContextMenu={(e) => e.preventDefault()}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 touch-none select-none"
                          aria-label="Hold to show password"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-300" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className="w-full bg-black/40 backdrop-blur-md border border-white/10
                           text-white shadow-md hover:bg-black/50 transition disabled:opacity-50"
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>

              {resetPasswordMutation.isError && (
                <div className="text-sm text-red-300 text-center" data-testid="text-error">
                  {resetPasswordMutation.error?.message || "Failed to reset password. The link may be invalid or expired."}
                </div>
              )}
            </form>
          </Form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setLocation("/auth")}
              className="text-sm text-white/70 hover:text-white underline"
              data-testid="link-back-to-login"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
