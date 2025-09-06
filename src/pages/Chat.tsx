import LeftMenu from "@/components/shell/LeftMenu";
import CenterChat from "@/components/chat/CenterChat";
import RightModels from "@/components/models/RightModels";

const Chat = () => {
  return (
    <div className="h-screen grid grid-cols-[280px_1fr_360px] gap-4 p-4 bg-background">
      {/* Left Menu */}
      <div className="overflow-y-auto border border-border rounded-lg">
        <LeftMenu />
      </div>
      
      {/* Center Chat */}
      <div className="overflow-y-auto border border-border rounded-lg flex flex-col">
        <CenterChat />
      </div>
      
      {/* Right Models */}
      <div className="overflow-y-auto border border-border rounded-lg">
        <RightModels />
      </div>
    </div>
  );
};

export default Chat;