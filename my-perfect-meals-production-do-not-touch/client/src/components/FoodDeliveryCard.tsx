interface FoodDeliveryCardProps {
  className?: string;
}

export default function FoodDeliveryCard({ className = "" }: FoodDeliveryCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">🍔 Food Delivery</h3>
      <p className="text-sm opacity-90 mb-3">
        Get your groceries or meals delivered from services like Instacart or Uber Eats directly to your door.
      </p>
      <div className="text-xs bg-white/20 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}