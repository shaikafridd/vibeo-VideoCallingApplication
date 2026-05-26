import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LandingPage from './LandingPage.jsx';
import Authenticate from './Authenticate.jsx';
import Home from './Home.jsx';
import VideoMeet from './VideoMeet.jsx';
import History from './History.jsx';
import NotFound from './NotFound.jsx';

export default function Landing() {
    return (
        <>
            <Router>
                <Routes>
                    <Route path='/' element={<LandingPage />} />
                    <Route path="/auth" element={<Authenticate />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/room/:room_id" element={<VideoMeet />} />
                    <Route path="/history" element={<History />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Router>
        </>
    )
}