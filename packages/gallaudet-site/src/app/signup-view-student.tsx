
import { Suspense } from "react"
import SignupViewStudentContent from "../components/signup-view-student-content"

export default function SignupViewStudentPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <SignupViewStudentContent />
    </Suspense>
  )
}
