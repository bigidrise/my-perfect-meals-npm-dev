import Navigation from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { 
  Utensils, 
  Brain, 
  UserCheck, 
  RefreshCw, 
  TrendingUp, 
  ShoppingCart, 
  Users, 
  Smartphone, 
  Camera, 
  Bell,
  Check,
  Rocket,
  Calendar,
  Play,
  Dice2,
  Heart,
  Twitter,
  Facebook,
  Instagram,
  Linkedin
} from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();

  const handleSignIn = () => {
    navigate("/auth");
  };

  const handleStartPlanning = () => {
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Header Banner */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Utensils className="h-6 w-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">My Perfect Meals</h1>
        </div>
      </div>

      {/* Hero Section with Image */}
      <section className="bg-black py-8 lg:py-16 pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Image Section */}
          <div className="relative h-64 lg:h-96 rounded-xl overflow-hidden mb-8">
            <img 
              src="/images/home-hero.jpg?v=20241202" 
              alt="My Perfect Meals - AI Powered Nutrition"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f97316;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%23000000;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3EMy Perfect Meals%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <h1 className="text-3xl lg:text-5xl font-bold text-white mb-3">
                Your Perfect Meals,{" "}
                <span className="text-orange-500">Powered by AI</span>
              </h1>
              <p className="text-white/90 text-lg lg:text-xl mb-6 max-w-3xl">
                Effortlessly plan healthy meals tailored to your dietary preferences, health conditions, and fitness goals. Zero guesswork, maximum nutrition.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={handleStartPlanning}
                  className="btn-primary shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Dice2 className="mr-2 h-5 w-5" />
                  Start Planning Meals
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-2 border-white text-white hover:bg-white/10"
                  onClick={() => {
                    // Create demo user and go to meal planning
                    const demoUser = {
                      id: "demo_user_" + Date.now(),
                      username: "demo_user",
                      email: "demo@example.com", 
                      firstName: "Demo",
                      lastName: "User",
                      age: 28,
                      fitnessGoal: "muscle_gain",
                      dietaryRestrictions: ["gluten-free"],
                      dailyCalorieTarget: 2400
                    };
                    localStorage.setItem("userId", demoUser.id);
                    navigate("/meal-planning");
                  }}
                >
                  <Rocket className="mr-2 h-5 w-5" />
                  Quick Demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Profile Setup Demo */}
      <section className="bg-muted/30 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Personalization Made Simple
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Answer a few questions and let our AI create a nutrition plan that's perfectly tailored to you.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Profile Setup</span>
                <span>Step 2 of 4</span>
              </div>
              <Progress value={50} className="h-2" />
            </div>

            <Card className="shadow-lg">
              <CardContent className="p-8 lg:p-12">
                <h3 className="text-2xl font-bold text-foreground mb-8">Tell us about your dietary preferences</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">Dietary Restrictions</label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">Vegetarian</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" defaultChecked />
                        <span className="text-foreground">Gluten-Free</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">Dairy-Free</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">Keto</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">Health Conditions</label>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">Diabetes</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">High Blood Pressure</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">Heart Disease</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 mr-3" />
                        <span className="text-foreground">Food Allergies</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <label className="block text-sm font-medium text-foreground mb-3">Fitness Goals</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Button variant="outline" className="p-4 h-auto flex-col">
                      <TrendingUp className="h-6 w-6 text-muted-foreground mb-2" />
                      <div className="font-medium">Weight Loss</div>
                    </Button>
                    <Button className="p-4 h-auto flex-col btn-primary">
                      <UserCheck className="h-6 w-6 text-primary-foreground mb-2" />
                      <div className="font-medium text-primary-foreground">Muscle Gain</div>
                    </Button>
                    <Button variant="outline" className="p-4 h-auto flex-col">
                      <Heart className="h-6 w-6 text-muted-foreground mb-2" />
                      <div className="font-medium">Maintenance</div>
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between mt-12">
                  <Button variant="outline">
                    <span className="mr-2">←</span>
                    Previous
                  </Button>
                  <Button onClick={handleSignIn} className="btn-primary">
                    Continue
                    <span className="ml-2">→</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Meal Generation Demo */}
      <section className="bg-background py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              AI-Powered Meal Planning
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our AI analyzes your preferences and generates perfectly balanced meals for your entire week.
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="gradient-primary rounded-2xl p-8 lg:p-12 text-white mb-12">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Generating Your Perfect Week</h3>
                  <p className="text-white/90">Based on your profile: Gluten-Free, Muscle Gain, 2,200 calories/day</p>
                </div>
                <div className="hidden lg:block">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.1s]"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  </div>
                </div>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <div className="flex items-center text-sm">
                  <Brain className="mr-2 h-4 w-4" />
                  <span>Analyzing nutritional requirements... Finding optimal protein sources... Balancing macronutrients...</span>
                </div>
              </div>
            </div>

            {/* Generated Meal Plan */}
            <Card className="bg-muted/30">
              <CardContent className="p-8 lg:p-12">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-foreground">Your Weekly Meal Plan</h3>
                  <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm" className="text-black hover:text-primary">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button size="sm" className="btn-primary">
                      <span className="mr-2">💾</span>
                      Save Plan
                    </Button>
                  </div>
                </div>

                {/* Weekly Calendar - Simplified for mobile */}
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mb-8">
                  <Card className="shadow-sm">
                    <CardContent className="p-4">
                      <div className="text-center mb-4">
                        <div className="text-lg font-bold text-foreground">Monday</div>
                        <div className="text-sm text-muted-foreground">Dec 4</div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Breakfast</div>
                          <img 
                            src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=150" 
                            alt="Greek yogurt with berries" 
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                          <div className="text-sm font-medium text-foreground">Greek Yogurt Bowl</div>
                          <div className="text-xs text-muted-foreground">385 cal</div>
                        </div>
                        
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Lunch</div>
                          <img 
                            src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=150" 
                            alt="Quinoa salad with chicken" 
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                          <div className="text-sm font-medium text-foreground">Quinoa Power Bowl</div>
                          <div className="text-xs text-muted-foreground">645 cal</div>
                        </div>
                        
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Dinner</div>
                          <img 
                            src="https://images.unsplash.com/photo-1467003909585-2f8a72700288?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=150" 
                            alt="Grilled salmon with vegetables" 
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                          <div className="text-sm font-medium text-foreground">Salmon & Vegetables</div>
                          <div className="text-xs text-muted-foreground">520 cal</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Simplified remaining days */}
                  {['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
                    <div key={day} className="hidden lg:block">
                      <Card className="shadow-sm h-full">
                        <CardContent className="p-4">
                          <div className="text-center mb-4">
                            <div className="text-lg font-bold text-foreground">{day}</div>
                            <div className="text-sm text-muted-foreground">Dec {5 + index}</div>
                          </div>
                          <div className="space-y-3 text-center">
                            <div className="text-xs">📱 View Details</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>

                {/* Nutrition Summary */}
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <h4 className="text-lg font-bold text-foreground mb-4">Weekly Nutrition Summary</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">2,187</div>
                        <div className="text-sm text-muted-foreground">Avg Calories/Day</div>
                        <div className="text-xs text-muted-foreground">Target: 2,200</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-secondary">165g</div>
                        <div className="text-sm text-muted-foreground">Avg Protein/Day</div>
                        <div className="text-xs text-muted-foreground">Target: 160g</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-accent">248g</div>
                        <div className="text-sm text-muted-foreground">Avg Carbs/Day</div>
                        <div className="text-xs text-muted-foreground">Target: 250g</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">73g</div>
                        <div className="text-sm text-muted-foreground">Avg Fat/Day</div>
                        <div className="text-xs text-muted-foreground">Target: 75g</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/30 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Everything You Need for Perfect Nutrition
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive tools to help you achieve your health and fitness goals through personalized nutrition.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "AI-Powered Planning",
                description: "Our advanced AI analyzes your unique profile to generate perfectly balanced meal plans that adapt to your changing needs.",
                color: "text-orange-500"
              },
              {
                icon: UserCheck,
                title: "Health Condition Support",
                description: "Specialized meal plans for diabetes, heart disease, and other health conditions, designed with medical expertise.",
                color: "text-orange-500"
              },
              {
                icon: RefreshCw,
                title: "Smart Substitutions",
                description: "Don't have an ingredient? Our AI suggests perfect alternatives that maintain nutritional balance and taste.",
                color: "text-orange-500"
              },
              {
                icon: TrendingUp,
                title: "Progress Tracking",
                description: "Monitor your nutrition intake, track compliance, and see your progress toward health and fitness goals.",
                color: "text-orange-500"
              },
              {
                icon: ShoppingCart,
                title: "Smart Shopping Lists",
                description: "Automatically generated shopping lists organized by store section, with quantity optimization and cost estimates.",
                color: "text-orange-500"
              },
              {
                icon: Users,
                title: "Family Planning",
                description: "Plan meals for the whole family with different dietary needs, preferences, and portion sizes all in one place.",
                color: "text-orange-500"
              }
            ].map((feature, index) => (
              <Card key={index} className="shadow-sm hover:shadow-lg transition-all">
                <CardContent className="p-8">
                  <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-6">
                    <feature.icon className={`${feature.color} text-xl h-6 w-6`} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Preview */}
      <section className="bg-background py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            <div className="mb-12 lg:mb-0">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
                Perfect Nutrition,{" "}
                <span className="text-primary">On the Go</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Access your meal plans, track nutrition, and get AI suggestions wherever you are with our mobile app.
              </p>
              
              <div className="space-y-6">
                {[
                  {
                    icon: Smartphone,
                    title: "Offline Access",
                    description: "View your meal plans and recipes even without internet connection.",
                    color: "text-orange-500"
                  },
                  {
                    icon: Camera,
                    title: "Meal Logging",
                    description: "Snap photos of your meals for easy tracking and AI analysis.",
                    color: "text-orange-500"
                  },
                  {
                    icon: Bell,
                    title: "Smart Reminders",
                    description: "Get personalized notifications for meal prep and eating times.",
                    color: "text-orange-500"
                  }
                ].map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <feature.icon className={`${feature.color} h-4 w-4`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-4 mt-8">
                <Button variant="outline" className="bg-foreground text-background hover:bg-foreground/90">
                  <span className="mr-2">🍎</span>
                  <div className="text-left">
                    <div className="text-xs">Download on the</div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </Button>
                <Button variant="outline" className="bg-foreground text-background hover:bg-foreground/90">
                  <span className="mr-2">📱</span>
                  <div className="text-left">
                    <div className="text-xs">Get it on</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </Button>
              </div>
            </div>
            
            <div className="relative flex justify-center">
              {/* Mobile mockup */}
              <div className="relative w-80 h-[640px] bg-foreground rounded-[3rem] p-2 shadow-2xl">
                <div className="w-full h-full bg-background rounded-[2.5rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="bg-background h-12 flex items-center justify-between px-6 text-foreground">
                    <div className="text-sm font-medium">9:41</div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs">📶</span>
                      <span className="text-xs">📶</span>
                      <span className="text-xs">🔋</span>
                    </div>
                  </div>
                  
                  {/* App content */}
                  <div className="bg-muted/30 h-full">
                    {/* Header */}
                    <div className="bg-background p-4 shadow-sm border-b">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h1 className="text-lg font-bold text-foreground">Today's Plan</h1>
                          <p className="text-sm text-muted-foreground">Monday, Dec 4</p>
                        </div>
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Bell className="text-primary h-4 w-4" />
                        </div>
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-foreground">Daily Progress</span>
                          <span className="text-sm font-medium text-foreground">1,547 / 2,200 cal</span>
                        </div>
                        <Progress value={70} className="h-2 mt-2" />
                      </div>
                    </div>
                    
                    {/* Meals */}
                    <div className="p-4 space-y-4">
                      <Card className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                                <span className="text-secondary text-sm">☀️</span>
                              </div>
                              <div>
                                <h3 className="font-medium text-foreground">Breakfast</h3>
                                <p className="text-xs text-muted-foreground">8:00 AM</p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-foreground">385 cal</span>
                          </div>
                          <img 
                            src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=120" 
                            alt="Greek yogurt breakfast bowl" 
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                          <p className="text-sm font-medium text-foreground">Greek Yogurt with Berries</p>
                          <div className="flex items-center justify-between mt-2">
                            <Button size="sm" variant="ghost" className="text-xs text-primary">View Recipe</Button>
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">Mark as Eaten</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-muted/30 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Choose Your Perfect Plan
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Start free and upgrade when you're ready for advanced features and premium support.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className="shadow-sm hover:shadow-lg transition-all">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Starter</h3>
                  <div className="text-4xl font-bold text-foreground mb-1">$0</div>
                  <div className="text-muted-foreground">Forever free</div>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "Basic meal planning",
                    "3 dietary preferences",
                    "Weekly meal plans",
                    "Basic nutrition tracking",
                    "Shopping list generation"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <Check className="text-primary h-4 w-4" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full">
                  Get Started Free
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="shadow-lg border-2 border-primary relative transform lg:scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">
                  Most Popular
                </Badge>
              </div>
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Pro</h3>
                  <div className="text-4xl font-bold text-foreground mb-1">$12</div>
                  <div className="text-muted-foreground">per month</div>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "Everything in Starter",
                    "Unlimited dietary preferences",
                    "AI-powered substitutions",
                    "Health condition support",
                    "Family meal planning",
                    "Advanced nutrition analytics",
                    "Mobile app access"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <Check className="text-primary h-4 w-4" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full btn-primary">
                  Start Pro Trial
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="shadow-sm hover:shadow-lg transition-all">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Premium</h3>
                  <div className="text-4xl font-bold text-foreground mb-1">$24</div>
                  <div className="text-muted-foreground">per month</div>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "Everything in Pro",
                    "Potluck planning",
                    "Restaurant guide integration",
                    "Recovery nutrition plans",
                    "Custom recipe creation",
                    "Priority support",
                    "Nutritionist consultations"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <Check className="text-primary h-4 w-4" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full btn-accent">
                  Go Premium
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="gradient-primary py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">
            Start Your Perfect Nutrition Journey Today
          </h2>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Join thousands of users who have transformed their health with AI-powered meal planning. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleSignIn}
              className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl"
            >
              <Rocket className="mr-2 h-5 w-5" />
              Sign In
            </Button>
            <Button 
              variant="outline" 
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold"
            >
              <Calendar className="mr-2 h-5 w-5" />
              Schedule Demo
            </Button>
          </div>
          <div className="flex items-center justify-center space-x-8 mt-12 text-white/75">
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center mb-6">
                <Utensils className="text-primary text-2xl mr-2 h-6 w-6" />
                <span className="text-xl font-bold">My Perfect Meals</span>
              </div>
              <p className="text-background/70 leading-relaxed mb-6 max-w-md">
                AI-powered personalized nutrition and meal planning for everyone. From busy families to professional athletes, we make healthy eating effortless.
              </p>
              <div className="flex space-x-4">
                <Button size="sm" variant="ghost" className="w-10 h-10 bg-background/10 hover:bg-primary text-black">
                  <Twitter className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="w-10 h-10 bg-background/10 hover:bg-primary text-black">
                  <Facebook className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="w-10 h-10 bg-background/10 hover:bg-primary text-black">
                  <Instagram className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="w-10 h-10 bg-background/10 hover:bg-primary text-black">
                  <Linkedin className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-3 text-background/70">
                <li><Button variant="link" className="text-background/70 hover:text-background p-0 h-auto">Features</Button></li>
                <li><Button variant="link" className="text-background/70 hover:text-background p-0 h-auto">Pricing</Button></li>
                <li><Button variant="link" className="text-background/70 hover:text-background p-0 h-auto">Mobile App</Button></li>
                <li><Button variant="link" className="text-background/70 hover:text-background p-0 h-auto">API</Button></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-3 text-background/70">
                <li><a href="mailto:support@myperfectmeals.com" className="text-background/70 hover:text-background">Contact Us</a></li>
                <li><Button variant="link" onClick={() => navigate("/privacy-policy")} className="text-background/70 hover:text-background p-0 h-auto">Privacy Policy</Button></li>
                <li><Button variant="link" onClick={() => navigate("/terms")} className="text-background/70 hover:text-background p-0 h-auto">Terms of Service</Button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-background/20 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-background/70 mb-4 md:mb-0">
              © 2024 My Perfect Meals. All rights reserved.
            </div>
            <div className="flex items-center space-x-4 text-background/70">
              <span>Made with</span>
              <Heart className="text-red-500 h-4 w-4" />
              <span>for healthier living</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
