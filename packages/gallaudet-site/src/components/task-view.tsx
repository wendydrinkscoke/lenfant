import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

type TaskViewProps = {
  audience: "student" | "teacher";
};

type PlaceholderTask = {
  title: string;
  subheading: string;
  instructions: string;
  partnerName: string;
  estimatedMinutes: number;
  previewImage: string;
  previewCaption: string;
};

const PLACEHOLDER_TASKS: PlaceholderTask[] = [
  {
    title: "Explore the Capitol Building",
    subheading: "Discover the chambers where federal laws are debated.",
    instructions:
      "Meet the guide NPC in the Capitol rotunda to begin your tour. Collect three knowledge tokens by answering questions from staffers. Finish by ringing the Liberty Bell replica in the visitor center to unlock a commemorative badge.",
    partnerName: "CivicTech Studios",
    estimatedMinutes: 15,
    previewImage: "/placeholder.svg",
    previewCaption: "The virtual Capitol invites exploration and discovery.",
  },
  {
    title: "Historic Monuments Photo Quest",
    subheading: "Capture iconic landmarks to build a commemorative gallery.",
    instructions:
      "Use the in-game camera to snap photos of the Washington Monument, Lincoln Memorial, and Jefferson Memorial. Add captions describing the significance of each monument, then submit your gallery at the National Archives kiosk to earn a creativity bonus.",
    partnerName: "District Adventures",
    estimatedMinutes: 20,
    previewImage: "/placeholder.svg",
    previewCaption: "Showcase your best shots from around the National Mall.",
  },
];

const selectPlaceholderTask = (taskId?: string | null): PlaceholderTask => {
  if (!taskId) {
    return PLACEHOLDER_TASKS[0];
  }
  const checksum = taskId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PLACEHOLDER_TASKS[checksum % PLACEHOLDER_TASKS.length];
};

const formatAudienceLabel = (audience: "student" | "teacher") =>
  audience === "teacher" ? "Teacher Preview" : "Student Assignment";

const TaskView = ({ audience }: TaskViewProps) => {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");

  const task = useMemo(() => selectPlaceholderTask(taskId), [taskId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Badge variant="secondary" className="uppercase tracking-wide">
                {formatAudienceLabel(audience)}
              </Badge>
              <CardTitle className="mt-3 text-3xl font-semibold text-slate-900">
                {task.title}
              </CardTitle>
              <p className="mt-2 text-base text-slate-600">
                {task.subheading}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-slate-500 md:items-end">
              <span>
                <strong>Estimated time:</strong> {task.estimatedMinutes} minutes
              </span>
              <span>
                <strong>Partner:</strong> {task.partnerName}
              </span>
              {taskId && (
                <span className="font-mono text-xs text-slate-400">
                  Task ID: {taskId}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-[2fr,1fr] md:gap-8">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-800">
                  Instructions
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  {task.instructions}
                </p>
              </div>
              <div>
                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <img
                    alt={task.previewCaption}
                    src={task.previewImage}
                    className="h-48 w-full object-cover"
                  />
                  <Separator />
                  <p className="p-3 text-sm text-slate-500">
                    {task.previewCaption}
                  </p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-slate-500">
              {audience === "teacher" ? (
                <p>
                  You’re viewing the teacher preview. Share this assignment with
                  your students directly from Google Classroom. Any updates you
                  make will appear here instantly.
                </p>
              ) : (
                <p>
                  Ready to begin? Use the instructions above to guide your
                  adventure. Your progress will automatically sync with your
                  Google Classroom.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskView;
