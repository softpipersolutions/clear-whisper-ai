const SkipToContent = () => {
  const handleSkip = () => {
    const main = document.getElementById('main-content');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  };

  return (
    <button
      onClick={handleSkip}
      className="fixed top-2 left-2 z-50 bg-accent text-accent-foreground px-4 py-2 rounded-md
                 opacity-0 -translate-y-full transition-all duration-200 focus:opacity-100 focus:translate-y-0
                 shadow-lg border border-accent/20"
    >
      Skip to main content
    </button>
  );
};

export default SkipToContent;