import { Badge } from "@/components/ui/badge";

interface FeatureLabelProps {
  plan: "Basic" | "Premium" | "Ultimate";
  isOpenDuringTesting?: boolean;
}

export default function FeatureLabel({ plan, isOpenDuringTesting }: FeatureLabelProps) {
  let label = "";
  let style = "";

  if (isOpenDuringTesting) {
    label = "Available During Testing";
    style = "bg-green-500 text-white";
  } else {
    switch (plan) {
      case "Premium":
        label = "Premium Plan";
        style = "bg-yellow-500 text-white";
        break;
      case "Ultimate":
        label = "Ultimate Plan";
        style = "bg-orange-600 text-white";
        break;
      default:
        label = "Basic Feature";
        style = "bg-gray-300 text-black";
    }
  }

  return (
    <Badge className={`text-xs px-2 py-0.5 rounded-sm ${style}`}>{label}</Badge>
  );
}