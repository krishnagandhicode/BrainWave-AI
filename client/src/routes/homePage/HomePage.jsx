import { Link } from "react-router-dom";
import "./homePage.css";
// import { TypeAnimation } from "react-type-animation";
// import { useState } from "react";

const HomePage = () => {
  // const [typingStatus, setTypingStatus] = useState("human1");

  return (
    <div className="homePage">
      <img src="/orbital.png" alt="" className="orbital" />
      <div className="left">
        <h1>BrainWave</h1>
        <h2>Supercharge your creativity and productivity</h2>
        <h3>
          &quot;Machine Minds, Human Potential - Creating the Future Together!&quot;
        </h3>
        <Link to="/dashboard">Get Started</Link>
      </div>
      <div className="right">
        <div className="imgContainer">
          <div className="bgContainer">
            <div className="bg"></div>
          </div>
          <img src="/bot.png" alt="" className="bot" />
        </div>
      </div>
      <div className="terms">
        <img src="/wave1.ai.png" alt="" />
        <div className="links">
          <Link to="/">Terms of Services</Link>
          <span>!</span>
          <Link to="/">Private Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;