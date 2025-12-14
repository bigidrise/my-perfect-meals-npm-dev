
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Cake, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface BirthdayGreetingProps {
  userId: number;
}

export const BirthdayGreeting = ({ userId }: BirthdayGreetingProps) => {
  const { data: userData } = useQuery({
    queryKey: [`/api/users/${userId}`],
  });

  // Check if today is the user's birthday
  const isBirthday = () => {
    if (!userData?.birthday) return false;
    
    const today = new Date();
    const todayMonth = (today.getMonth() + 1).toString().padStart(2, "0");
    const todayDay = today.getDate().toString().padStart(2, "0");
    const todayFormatted = `${todayMonth}-${todayDay}`;
    
    // Birthday can be stored as "MM-DD" or "YYYY-MM-DD"
    const userBirthday = userData.birthday.includes("-") 
      ? userData.birthday.slice(-5) // Get last 5 chars (MM-DD)
      : userData.birthday;
    
    return todayFormatted === userBirthday;
  };
  
  if (!isBirthday()) return null;

  return (
    <Card className="w-full bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cake className="w-5 h-5 text-orange-500" />
          Happy Birthday! 🎉
        </CardTitle>
        <CardDescription>
          Today is your special day!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-3">
          <div className="flex justify-center gap-1">
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
            <Gift className="w-8 h-8 text-orange-500" />
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200">
              Wishing you a fantastic birthday!
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              As a birthday treat, enjoy your favorite meal today guilt-free! 
              We'll help you get back on track tomorrow.
            </p>
          </div>

          <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              🎁 Birthday Bonus: Free cheat meal added to your plan!
            </p>
          </div>
        </div>
        
        <Button className="w-full bg-orange-500 hover:bg-orange-600">
          <Gift className="w-4 w-4 mr-2" />
          Claim Birthday Treat
        </Button>
      </CardContent>
    </Card>
  );
};
