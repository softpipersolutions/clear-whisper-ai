import LeftMenu from "@/components/shell/LeftMenu";
import CenterChat from "@/components/chat/CenterChat";
import RightModels from "@/components/models/RightModels";
import { motion } from "framer-motion";

const Chat = () => {
  return (
    <div className="h-screen bg-background transition-colors duration-200">
      <div className="h-full grid grid-cols-[280px_1fr_360px] gap-4 p-4">
        {/* Left Menu */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-y-auto bg-panel border border-border rounded-2xl shadow-brand"
        >
          <LeftMenu />
        </motion.div>
        
        {/* Center Chat */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="overflow-y-auto bg-panel border border-border rounded-2xl shadow-brand flex flex-col"
        >
          <CenterChat />
        </motion.div>
        
        {/* Right Models */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="overflow-y-auto bg-panel border border-border rounded-2xl shadow-brand"
        >
          <RightModels />
        </motion.div>
      </div>
    </div>
  );
};

export default Chat;