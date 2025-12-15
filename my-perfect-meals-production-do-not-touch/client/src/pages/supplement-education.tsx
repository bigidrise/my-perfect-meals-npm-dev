import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowUp,
  ExternalLink,
  Brain,
  Shield,
  Users,
  Target,
  Star,
  CheckCircle,
  AlertCircle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface SupplementProduct {
  name: string;
  category: string;
  description: string;
  benefits: string[];
  dosage: string;
  price: string;
  rating: number;
  featured: boolean;
}

export default function SupplementEducationPage() {
  const [, setLocation] = useLocation();
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const { toast } = useToast();

  const featuredProducts: SupplementProduct[] = [
    {
      name: "EstroCleanse",
      category: "Women's Health",
      description:
        "Comprehensive estrogen metabolism support for hormonal balance",
      benefits: [
        "Supports healthy estrogen metabolism",
        "Promotes liver detoxification",
        "Helps maintain hormonal balance",
      ],
      dosage: "2 capsules daily with meals",
      price: "$45.99",
      rating: 4.8,
      featured: true,
    },
    {
      name: "G.I. Complete",
      category: "Digestive Health",
      description:
        "Complete digestive support with probiotics and digestive enzymes",
      benefits: [
        "Supports healthy digestion",
        "Promotes gut microbiome balance",
        "Reduces digestive discomfort",
      ],
      dosage: "1 capsule with each meal",
      price: "$52.99",
      rating: 4.9,
      featured: true,
    },
    {
      name: "Ultimate Shake",
      category: "Protein & Recovery",
      description: "Premium protein blend with added vitamins and minerals",
      benefits: [
        "High-quality protein for muscle support",
        "Added vitamins and minerals",
        "Great taste and mixability",
      ],
      dosage: "1 scoop daily or as needed",
      price: "$65.99",
      rating: 4.7,
      featured: true,
    },
    {
      name: "Thyro-Complete",
      category: "Thyroid Support",
      description:
        "Comprehensive thyroid support formula with essential nutrients",
      benefits: [
        "Supports healthy thyroid function",
        "Provides essential thyroid nutrients",
        "Promotes energy metabolism",
      ],
      dosage: "2 capsules daily on empty stomach",
      price: "$48.99",
      rating: 4.6,
      featured: true,
    },
  ];

  const supplementAIMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch(apiUrl("/api/ai/supplement-advice"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) throw new Error("Failed to get supplement advice");
      return response.json();
    },
    onSuccess: (data) => {
      setAiResponse(data.advice);
      toast({
        title: "AI Advice Ready",
        description: "Your supplement question has been answered below.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get supplement advice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            onClick={() => setLocation("/supplement-hub")}
            className="flex items-center gap-2 bg-black/30 backdrop-blur-lg border border-white/20 text-white hover:bg-black/40 transition-all duration-200 rounded-xl shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-black/20 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-white mb-4">
               Supplement Education Hub
            </h1>
            <p className="text-sm text-white/90 max-w-2xl mx-auto">
              Evidence-based supplement information and personalized
              recommendations for your wellness journey
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* AI Supplement Advisor */}
          <Card className="h-fit bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardHeader className="bg-black/20 border-b border-white/10 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Brain className="h-6 w-6 text-orange-400" />
                AI Supplement Advisor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Ask about supplements, interactions, or recommendations:
                  </label>
                  <Textarea
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="e.g., What supplements should I take for better sleep? Are there any interactions between magnesium and my medications?"
                    rows={4}
                    className="w-full bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>

                <Button
                  onClick={() => supplementAIMutation.mutate(aiQuestion)}
                  disabled={
                    supplementAIMutation.isPending || !aiQuestion.trim()
                  }
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {supplementAIMutation.isPending
                    ? "Getting Advice..."
                    : "Get AI Advice"}
                </Button>

                {aiResponse && (
                  <div className="mt-4 p-4 bg-black/20 backdrop-blur-lg rounded-lg border border-white/20">
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      AI Supplement Advice
                    </h4>
                    <p className="text-white/90 text-sm leading-relaxed">
                      {aiResponse}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Featured Products */}
          <Card className="h-fit bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardHeader className="bg-black/20 border-b border-white/10 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Star className="h-6 w-6 text-orange-400" />
                Featured Products
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {featuredProducts.map((product, index) => (
                  <div
                    key={index}
                    className="border border-white/20 bg-black/20 backdrop-blur-lg rounded-lg p-4 hover:bg-black/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-white/90">
                          {product.rating}
                        </span>
                      </div>
                    </div>

                    <Badge variant="secondary" className="mb-2 bg-orange-600/20 text-orange-300 border-orange-500/30">
                      {product.category}
                    </Badge>

                    <p className="text-sm text-white/80 mb-3">
                      {product.description}
                    </p>

                    <div className="space-y-1 mb-3">
                      {product.benefits.slice(0, 2).map((benefit, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs text-white/80"
                        >
                          <CheckCircle className="h-3 w-3 text-green-400" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-orange-400">
                        {product.price}
                      </span>
                      <Button size="sm" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        Learn More
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Educational Sections */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardHeader className="bg-black/20 border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg  text-white">
                <Shield className="h-5 w-5 text-orange-400" />
                Safety First
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 text-sm text-white/90">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Always consult healthcare providers before starting new
                    supplements
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Check for interactions with medications and other
                    supplements
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Start with recommended dosages and monitor your response
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardHeader className="bg-black/20 border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Target className="h-5 w-5 text-orange-400" />
                Quality Matters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 text-sm text-white/90">
                <div>• Third-party tested for purity</div>
                <div>• No artificial additives or fillers</div>
                <div>• Bioavailable forms of nutrients</div>
                <div>• Proper storage and handling</div>
                <div>• Transparent labeling practices</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardHeader className="bg-black/20 border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Users className="h-5 w-5 text-orange-400" />
                Community
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3 text-sm text-white/90">
                <div>• Join our supplement discussion forum</div>
                <div>• Share experiences with other users</div>
                <div>• Get peer support and advice</div>
                <div>• Access exclusive educational content</div>
                <div>• Monthly expert Q&A sessions</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-8">
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4 text-white">
                Ready to Optimize Your Health?
              </h2>
              <p className="mb-6 text-white/90">
                Visit our trusted supplement store for high-quality,
                research-backed products
              </p>
              <Button
                className="bg-orange-600 text-sm text-white hover:bg-orange-700"
                onClick={() => setLocation("/supplement-hub")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Supplement Store
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Back to Top */}
        <div className="text-center mt-8">
          <Button
            onClick={scrollToTop}
            variant="outline"
            className="flex items-center gap-2 mx-auto bg-black/30 backdrop-blur-lg border border-white/20 text-white hover:bg-black/40"
          >
            <ArrowUp className="h-4 w-4" />
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
