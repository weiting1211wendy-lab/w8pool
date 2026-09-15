import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import Layout from './components/Layout'
import { ModeProvider } from './components/ModeProvider'
import AuthProvider from './components/AuthProvider'
import WorkspaceGuard from './components/WorkspaceGuard'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import ApplicationForm from './pages/ApplicationForm'
import ApplicationDetail from './pages/ApplicationDetail'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Profile from './pages/Profile'
import AccountCenter from './pages/AccountCenter'
import JobPools from './pages/JobPools'
import SharedPoolDetail from './pages/SharedPoolDetail'
import SharedJobDetail from './pages/SharedJobDetail'
import Robot from './pages/Robot'
import CommunityPools from './pages/CommunityPools'
import ResumePrefill from './pages/ResumePrefill'
import type { AppMode } from './constants/appMode'
import Auth from './pages/Auth'

function appRoutes(): RouteObject[] {
  return [
    { index: true, element: <Dashboard /> },
    { path: 'applications', element: <Applications /> },
    { path: 'applications/new', element: <ApplicationForm /> },
    { path: 'applications/:id/edit', element: <ApplicationForm /> },
    { path: 'applications/:id', element: <ApplicationDetail /> },
    { path: 'tasks', element: <Tasks /> },
    { path: 'tasks/:applicationId', element: <TaskDetail /> },
    { path: 'profile', element: <AccountCenter /> },
    { path: 'resume', element: <Profile /> },
    { path: 'pools', element: <JobPools /> },
    { path: 'pools/:poolId', element: <SharedPoolDetail /> },
    { path: 'pools/:poolId/jobs/:jobId', element: <SharedJobDetail /> },
    { path: 'robot', element: <Robot /> },
    { path: 'community-pools', element: <CommunityPools /> },
    { path: 'community-pools/:poolId', element: <SharedPoolDetail variant="community" /> },
    { path: 'community-pools/:poolId/jobs/:jobId', element: <SharedJobDetail variant="community" /> },
    { path: 'resume/prefill', element: <ResumePrefill /> },
  ]
}

function ModeLayout({ mode }: { mode: AppMode }) {
  return (
    <ModeProvider mode={mode}>
      <Layout key={mode} />
    </ModeProvider>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <Welcome /> },
  {
    path: '/preview',
    element: <ModeLayout mode="preview" />,
    children: appRoutes(),
  },
  {
    path: '/workspace',
    element: (
      <WorkspaceGuard>
        <ModeLayout mode="workspace" />
      </WorkspaceGuard>
    ),
    children: appRoutes(),
  },
  { path: '/login', element: <Auth kind="login" /> },
  { path: '/register', element: <Auth kind="register" /> },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
