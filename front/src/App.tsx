import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import Processing from "@/pages/Processing";
import Review from "@/pages/Review";
import Chat from "@/pages/Chat";
import SpeakerSelect from "@/pages/SpeakerSelect";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/processing/:id" component={Processing} />
      <Route path="/select/:id" component={SpeakerSelect} />
      <Route path="/review/:id" component={Review} />
      <Route path="/chat/:jobId" component={Chat} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
