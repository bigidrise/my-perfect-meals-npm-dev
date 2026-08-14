import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLocation } from "wouter";
import { Utensils, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Navigation() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const handleSignIn = () => {
    navigate("/auth");
  };

  return (
    <nav className="bg-background shadow-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => navigate("/")}>
              <Utensils className="text-primary text-2xl mr-2 h-6 w-6" />
              <span className="text-xl font-bold text-foreground">{t("sharedComponents.navigation.appName")}</span>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <Button variant="ghost" className="text-black hover:text-primary">
                {t("sharedComponents.navigation.features")}
              </Button>
              <Button variant="ghost" className="text-black hover:text-primary">
                {t("sharedComponents.navigation.howItWorks")}
              </Button>
              <Button variant="ghost" className="text-black hover:text-primary">
                {t("sharedComponents.navigation.pricing")}
              </Button>
              <Button onClick={handleSignIn} className="btn-primary">
                {t("sharedComponents.navigation.signIn")}
              </Button>
            </div>
          </div>
          
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col space-y-4 mt-8">
                  <Button variant="ghost" className="justify-start">{t("sharedComponents.navigation.features")}</Button>
                  <Button variant="ghost" className="justify-start">{t("sharedComponents.navigation.howItWorks")}</Button>
                  <Button variant="ghost" className="justify-start">{t("sharedComponents.navigation.pricing")}</Button>
                  <Button onClick={handleSignIn} className="btn-primary justify-start">
                    {t("sharedComponents.navigation.signIn")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
