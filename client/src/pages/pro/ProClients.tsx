import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { proStore, ClientProfile, ProRole } from "@/lib/proData";
import { Plus, User2, ArrowRight, ArrowLeft, Archive, RotateCcw } from "lucide-react";
import TrashButton from "@/components/ui/TrashButton";

export default function ProClients(){
  const [, setLocation] = useLocation();
  const [clients, setClients] = useState<ClientProfile[]>(() => proStore.listClients());
  const [showArchived, setShowArchived] = useState(false);
  const [name,setName] = useState(""); 
  const [email,setEmail]=useState("");
  const [role, setRole] = useState<ProRole>("trainer");

  const add = () => {
    if (!name.trim()) return;
    const c: ClientProfile = { id: crypto.randomUUID(), name: name.trim(), email: email.trim() || undefined, role };
    const next = [c, ...clients]; setClients(next); proStore.saveClients(next);
    setName(""); setEmail(""); setRole("trainer");
  };
  
  const archiveClient = (id: string) => {
    proStore.archiveClient(id);
    setClients([...proStore.listClients()]);
  };
  
  const restoreClient = (id: string) => {
    proStore.restoreClient(id);
    setClients([...proStore.listClients()]);
  };
  
  const deleteClient = (id: string, name: string) => {
    proStore.deleteClient(id);
    setClients([...proStore.listClients()]);
  };
  
  const go = (id:string)=> {
    setLocation(`/pro/clients/${id}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => setLocation("/care-team")}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Pro Portal</h1>

          {/* Archive Toggle Button */}
          <Button
            onClick={() => setShowArchived(!showArchived)}
            variant="outline"
            size="sm"
            className="ml-auto bg-white/5 border-white/20 text-white hover:bg-white/10"
          >
            {showArchived ? "Show Active" : "Show Archived"}
          </Button>
        </div>
      </div>

      <div
        className="max-w-5xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        <Card className="bg-white/5 border border-white/20">
          <CardHeader><CardTitle className="text-white">Add Client</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Name" className="bg-black/30 border-white/30 text-white" value={name} onChange={e=>setName(e.target.value)} />
              <Input placeholder="Email (optional)" className="bg-black/30 border-white/30 text-white" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <Button onClick={add} className="w-full bg-white/10 border border-white/20 text-white hover:bg-white/20"><Plus className="h-4 w-4 mr-1" />Add Client</Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          {clients.filter(c => showArchived ? c.archived : !c.archived).length===0 ? (
            <div className="text-white">{showArchived ? "No archived clients." : "No active clients yet. Add one above."}</div>
          ) : clients.filter(c => showArchived ? c.archived : !c.archived).map(c=>(
            <Card key={c.id} className="bg-white/5 border border-white/20" data-testid="pro-client-row">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center"><User2 className="h-5 w-5 text-white" /></div>
                  <div>
                    <div className="font-semibold text-white">{c.name}</div>
                    {c.email && <div className="text-white text-sm">{c.email}</div>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {c.role && (
                        <div className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-200 border border-purple-400/30">
                          {c.role === "doctor" ? "Doctor" : c.role === "nurse" ? "Nurse" : c.role === "pa" ? "PA" : c.role === "nutritionist" ? "Nutritionist" : c.role === "dietitian" ? "Dietitian" : "Trainer"}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2 text-xs">
                      <span className="text-white/50">Medical Status:</span>
                      <span className="text-amber-400 font-medium">Diabetes Active</span>
                      <span className="text-purple-400 font-medium">GLP-1 Active</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.archived ? (
                    <>
                      <TrashButton
                        onClick={() => deleteClient(c.id, c.name)}
                        size="sm"
                        confirm
                        confirmMessage={`Delete ${c.name} permanently? This will remove all data and cannot be undone.`}
                        ariaLabel={`Permanently delete ${c.name}`}
                        data-testid={`button-delete-client-${c.id}`}
                      />
                      <Button
                        onClick={() => restoreClient(c.id)}
                        variant="ghost"
                        size="icon"
                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                        data-testid={`button-restore-client-${c.id}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => archiveClient(c.id)}
                      variant="ghost"
                      size="icon"
                      className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                      data-testid={`button-archive-client-${c.id}`}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  <Button onClick={()=>go(c.id)} className="bg-purple-600 hover:bg-purple-700 text-white" data-testid="button-open-client">
                    Open <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
