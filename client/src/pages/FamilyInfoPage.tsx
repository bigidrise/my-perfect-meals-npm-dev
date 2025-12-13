import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Users, User, Crown } from "lucide-react";

export default function FamilyInfoPage() {
  const [, setLocation] = useLocation();
  const [wholehousePremium, setWholehousePremium] = useState(false);
  const [wholehouseUltimate, setWholehouseUltimate] = useState(false);
  const [memberUpgrades, setMemberUpgrades] = useState<Record<string, string>>({
    alice: "basic",
    bob: "basic",
    kid1: "basic",
    kid2: "basic",
  });

  const calculateTotal = () => {
    let total = 24.99; // Family base
    if (wholehousePremium) {
      total += 15; // All seats premium bundle
    } else if (wholehouseUltimate) {
      total += 45; // All seats ultimate bundle
    } else {
      Object.values(memberUpgrades).forEach((tier) => {
        if (tier === "premium") total += 6;
        if (tier === "ultimate") total += 14;
      });
    }
    return total.toFixed(2);
  };

  const handleMemberUpgrade = (member: string, tier: string) => {
    setMemberUpgrades((prev) => ({ ...prev, [member]: tier }));
    if (tier !== "basic") {
      setWholehousePremium(false);
      setWholehouseUltimate(false);
    }
  };

  const handleHouseholdBundle = (type: "premium" | "ultimate") => {
    if (type === "premium") {
      setWholehousePremium(!wholehousePremium);
      setWholehouseUltimate(false);
      setMemberUpgrades({
        alice: "basic",
        bob: "basic",
        kid1: "basic",
        kid2: "basic",
      });
    } else {
      setWholehouseUltimate(!wholehouseUltimate);
      setWholehousePremium(false);
      setMemberUpgrades({
        alice: "basic",
        bob: "basic",
        kid1: "basic",
        kid2: "basic",
      });
    }
  };

  // unified black-glass styling
  const glassCard =
    "relative isolate bg-white/5 backdrop-blur-2xl border border-white/30 shadow-2xl rounded-2xl";
  const textWhite = "text-white";

  return (
    <div className="min-h-screen w-full text-white bg-gradient-to-br from-neutral-900 via-black to-neutral-900">
      <div className="container max-w-5xl mx-auto px-4 py-6 md:py-12">
        {/* Back Button to Pricing */}
        <Button
          variant="ghost"
          className="fixed top-4 left-4 z-50 inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/20 hover:bg-white/10 text-white"
          onClick={() => setLocation("/pricing")}
          data-testid="button-back-to-pricing"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pricing
        </Button>

        {/* Header strip */}
        <div className={`${glassCard} mb-8 px-6 py-6 text-white`}>
          <span className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-white/10 via-transparent to-transparent" />
          <h1 className="text-2xl font-bold">Family Plan — Preview</h1>
          <p className="text-sm mt-2 text-white">
            Configure how premiums apply across your 4 family accounts.
          </p>
        </div>

        {/* Preview banner */}
        <Card className={`${glassCard} mb-8 text-white`}>
          <span className="absolute inset-0 -z-10 rounded-2xl pointer-events-none bg-gradient-to-br from-emerald-400/10 via-transparent to-transparent" />
          <CardContent className="p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Badge className="bg-emerald-600/30 border border-emerald-300/30 text-white">
                Preview
              </Badge>
              <h3 className="text-lg font-bold">Family Plan Configuration</h3>
            </div>
            <p className="text-white">
              Use this screen to test how household-wide bundles or individual
              premiums affect pricing.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Panel */}
          <div className="space-y-6">
            <Card className={`${glassCard} text-white`}>
              <span className="absolute inset-0 -z-10 rounded-2xl pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <CardHeader className="pb-2 text-white">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Household-Wide Bundles
                </h2>
                <p className="text-sm text-white">
                  Discounted premiums for all 4 accounts
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-white">
                <div className="flex items-center justify-between rounded-xl p-4 bg-white/5 border border-white/10">
                  <div>
                    <div className="font-medium">All Premium Bundle</div>
                    <div className="text-sm text-white">
                      +$15/mo (save $9/mo vs individual)
                    </div>
                  </div>
                  <Switch
                    checked={wholehousePremium}
                    onCheckedChange={() => handleHouseholdBundle("premium")}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl p-4 bg-white/5 border border-white/10">
                  <div>
                    <div className="font-medium">All Ultimate Bundle</div>
                    <div className="text-sm text-white">
                      +$45/mo (save $11/mo vs individual)
                    </div>
                  </div>
                  <Switch
                    checked={wholehouseUltimate}
                    onCheckedChange={() => handleHouseholdBundle("ultimate")}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={`${glassCard} text-white`}>
              <span className="absolute inset-0 -z-10 rounded-2xl pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <CardHeader className="pb-2 text-white">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Individual Member Premiums
                </h2>
                <p className="text-sm text-white">
                  Premium specific accounts only
                </p>
              </CardHeader>
              <CardContent className="space-y-5 text-white">
                {[
                  { key: "alice", name: "Alice (Parent)", icon: "👩‍🍳" },
                  { key: "bob", name: "Bob (Parent)", icon: "👨‍🍳" },
                  { key: "kid1", name: "Kid 1 (Age 8)", icon: "🧒" },
                  { key: "kid2", name: "Kid 2 (Age 12)", icon: "👦" },
                ].map((member) => (
                  <div
                    key={member.key}
                    className="space-y-3 rounded-xl p-4 bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{member.icon}</span>
                      <span className="font-medium"> {member.name}</span>
                      {member.key.includes("kid") && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-white/10 border border-white/20 text-white"
                        >
                          Kids features auto-included
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={
                          memberUpgrades[
                            member.key as keyof typeof memberUpgrades
                          ] === "basic"
                            ? "default"
                            : "outline"
                        }
                        className="bg-white/10 border-white/30 hover:bg-white/20 text-white"
                        onClick={() => handleMemberUpgrade(member.key, "basic")}
                        disabled={wholehousePremium || wholehouseUltimate}
                      >
                        Basic (included)
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          memberUpgrades[
                            member.key as keyof typeof memberUpgrades
                          ] === "premium"
                            ? "default"
                            : "outline"
                        }
                        className="bg-white/10 border-white/30 hover:bg-white/20 text-white"
                        onClick={() =>
                          handleMemberUpgrade(member.key, "premium")
                        }
                        disabled={wholehousePremium || wholehouseUltimate}
                      >
                        Premium (+$6/mo)
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          memberUpgrades[
                            member.key as keyof typeof memberUpgrades
                          ] === "ultimate"
                            ? "default"
                            : "outline"
                        }
                        className="bg-white/10 border-white/30 hover:bg-white/20 text-white"
                        onClick={() =>
                          handleMemberUpgrade(member.key, "ultimate")
                        }
                        disabled={wholehousePremium || wholehouseUltimate}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Ultimate (+$14/mo)
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Summary Panel */}
          <div>
            <Card className={`${glassCard} sticky top-6 text-white`}>
              <span className="absolute inset-0 -z-10 rounded-2xl pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent" />
              <CardHeader className="pb-2 text-white">
                <h2 className="text-xl font-semibold">Pricing Summary</h2>
              </CardHeader>
              <CardContent className="space-y-4 text-white">
                <div className="flex justify-between">
                  <span className="text-white">
                    Family Plan Base (4 accounts)
                  </span>
                  <span className="text-white">$24.99</span>
                </div>

                {wholehousePremium && (
                  <div className="flex justify-between text-white">
                    <span>All Premium Bundle</span>
                    <span>+$15.00</span>
                  </div>
                )}

                {wholehouseUltimate && (
                  <div className="flex justify-between text-white">
                    <span>All Ultimate Bundle</span>
                    <span>+$45.00</span>
                  </div>
                )}

                {!wholehousePremium &&
                  !wholehouseUltimate &&
                  Object.entries(memberUpgrades).map(([key, tier]) => {
                    if (tier === "basic") return null;
                    const member =
                      key === "alice"
                        ? "Alice"
                        : key === "bob"
                          ? "Bob"
                          : key === "kid1"
                            ? "Kid 1"
                            : "Kid 2";
                    const cost = tier === "premium" ? "$6.00" : "$14.00";
                    return (
                      <div
                        key={key}
                        className="flex justify-between text-sm text-white"
                      >
                        <span>
                          {member} {tier}
                        </span>
                        <span>+{cost}</span>
                      </div>
                    );
                  })}

                <Separator className="bg-white/20" />

                <div className="flex justify-between text-lg font-bold text-white">
                  <span>Total Monthly</span>
                  <span>${calculateTotal()}</span>
                </div>

                <div className="text-xs text-white space-y-1">
                  <p>
                    • Kids features (read-aloud, simplified recipes)
                    automatically included for accounts under 13
                  </p>
                  <p>
                    • 21+ content automatically hidden for accounts under 21
                  </p>
                  <p>• Billing flexibility: change member premiums anytime</p>
                </div>
              </CardContent>

              <Separator className="bg-white/20" />

              {/* SINGLE bottom button — Welcome */}
              <div className="p-6">
                <Button
                  className="w-full bg-white/10 border border-white/30 hover:bg-white/20 text-white"
                  onClick={() => setLocation("/")}
                >
                  Welcome
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}