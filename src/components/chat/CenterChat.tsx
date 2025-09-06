import ChatHeader from "./ChatHeader";
import Transcript from "./Transcript";
import ChatComposer from "./ChatComposer";

const CenterChat = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Sticky header */}
      <div className="border-b border-border">
        <ChatHeader />
      </div>
      
      {/* Scrollable transcript */}
      <div className="flex-1 overflow-y-auto">
        <Transcript />
      </div>
      
      {/* Composer at bottom */}
      <div className="border-t border-border">
        <ChatComposer />
      </div>
    </div>
  );
};

export default CenterChat;