import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Upload, FileText, Calendar, Loader2, CheckCircle, Clock, User, Paperclip, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { projectsService, ProjectWithSubmission, ProjectSubmission } from '@/services/projects.service';
import { useAuth } from '@/contexts/AuthContext';
import { downloadProjectFile } from '@/lib/download';

const ProjectDetail = () => {
  const { courseId, projectId } = useParams<{ courseId: string; projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsService.getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: allSubmissions } = useQuery({
    queryKey: ['projectSubmissions', projectId],
    queryFn: () => projectsService.getProjectSubmissions(projectId!),
    enabled: !!projectId && user?.role === 'instructor',
  });

  // Public submissions visible to all users
  const { data: publicSubmissions } = useQuery({
    queryKey: ['projectPublicSubmissions', projectId],
    queryFn: () => projectsService.getPublicProjectSubmissions(projectId!),
    enabled: !!projectId,
  });

  const submitMutation = useMutation({
    mutationFn: (data: { submissionText?: string; file?: File }) =>
      projectsService.submitProject(projectId!, { submissionText: data.submissionText }, data.file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectPublicSubmissions', projectId] });
      toast({ title: 'Project submitted successfully!' });
      setSubmissionText('');
      setSubmissionFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsSubmitting(false);
    },
    onError: () => {
      toast({ title: 'Failed to submit project', variant: 'destructive' });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionText.trim() && !submissionFile) {
      toast({ title: 'Please upload a file or provide a description', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    submitMutation.mutate({ submissionText, file: submissionFile || undefined });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Failed to load project. Please check your connection.</p>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Link to={`/player/${courseId}`}><Button variant="outline">Back to Course</Button></Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Project not found</p>
        <Link to={`/player/${courseId}`}>
          <Button>Back to Course</Button>
        </Link>
      </div>
    );
  }

  const { project, submission } = data;
  const isInstructor = user?.role === 'instructor';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link to={`/player/${courseId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Back to Course
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project info */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">{project.title}</h1>
                  {(project.dueDate || project.due_date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Due: {new Date(project.dueDate || project.due_date!).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {submission && (
                  <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${submission.status === 'graded'
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-blue-500/10 text-blue-600'
                    }`}>
                    {submission.status === 'graded' ? 'Graded' : 'Submitted'}
                  </div>
                )}
              </div>

              {project.description && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
                </div>
              )}

              {project.instructions && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Instructions</h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words">
                    <div dangerouslySetInnerHTML={{ __html: project.instructions }} />
                  </div>
                </div>
              )}

              {(project.attachment_url || project.attachmentUrl) && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Project File</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const url = project.attachment_url || project.attachmentUrl;
                      const name = project.attachment_name || project.attachmentName || 'attachment';
                      downloadProjectFile(url!, name);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    {project.attachment_name || project.attachmentName || 'Download Attachment'}
                  </button>
                </div>
              )}
            </div>

            {/* Submission section */}
            {!isInstructor && (
              <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                <h2 className="text-xl font-bold">Your Submission</h2>

                {submission ? (
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Submitted on</span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(submission.submittedAt || submission.submitted_at!).toLocaleString()}
                        </span>
                      </div>

                      {(submission.submissionUrl || submission.submission_url) && (submission.fileName || submission.file_name) && (
                        <div>
                          <span className="text-sm font-medium block mb-1">Submitted File</span>
                          <button
                            type="button"
                            onClick={() => {
                              const url = submission.submissionUrl || submission.submission_url;
                              const name = submission.fileName || submission.file_name || 'submission';
                              downloadProjectFile(url!, name);
                            }}
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                          >
                            <Paperclip className="h-3 w-3" />
                            {submission.fileName || submission.file_name}
                          </button>
                        </div>
                      )}

                      {(submission.submissionText || submission.submission_text) && (
                        <div>
                          <span className="text-sm font-medium block mb-1">Description</span>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {submission.submissionText || submission.submission_text}
                          </p>
                        </div>
                      )}

                      {submission.grade !== undefined && submission.grade !== null && (
                        <div className="pt-3 border-t border-border">
                          <span className="text-sm font-medium block mb-1">Grade</span>
                          <span className="text-2xl font-bold text-primary">
                            {submission.grade}%
                          </span>
                        </div>
                      )}

                      {(submission.instructorFeedback || submission.instructor_feedback) && (
                        <div className="pt-3 border-t border-border">
                          <span className="text-sm font-medium block mb-2">Instructor Feedback</span>
                          <div className="bg-background rounded-lg p-3">
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {submission.instructorFeedback || submission.instructor_feedback}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setIsSubmitting(true)}
                      className="w-full"
                    >
                      Resubmit Project
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You haven't submitted this project yet.
                  </p>
                )}

                {(isSubmitting || !submission) && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Upload File
                      </label>
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/20 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="submission-file"
                        />
                        <label htmlFor="submission-file" className="cursor-pointer">
                          {submissionFile ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-primary">
                              <Paperclip className="h-4 w-4" />
                              {submissionFile.name}
                              <span className="text-muted-foreground">
                                ({(submissionFile.size / 1024 / 1024).toFixed(2)} MB)
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                Click to select a file
                              </p>
                              <p className="text-xs text-muted-foreground">
                                All file types accepted
                              </p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Description / Notes (Optional)
                      </label>
                      <Textarea
                        value={submissionText}
                        onChange={(e) => setSubmissionText(e.target.value)}
                        placeholder="Describe your project submission..."
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={submitMutation.isPending}
                        className="flex-1"
                      >
                        {submitMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Submit Project
                          </>
                        )}
                      </Button>
                      {submission && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsSubmitting(false);
                            setSubmissionFile(null);
                            setSubmissionText('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Public submissions list - visible to all users */}
            {!isInstructor && publicSubmissions && publicSubmissions.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                <h2 className="text-lg font-bold text-foreground">
                  Student Submissions ({publicSubmissions.length})
                </h2>
                <div className="space-y-3">
                  {[...publicSubmissions]
                    .sort((a, b) => {
                      const gradeA = a.grade != null ? Number(a.grade) : -1;
                      const gradeB = b.grade != null ? Number(b.grade) : -1;
                      return gradeB - gradeA;
                    })
                    .map((sub: any) => (
                      <div
                        key={sub.id}
                        className={`rounded-lg border p-4 space-y-2 ${sub.user_id === user?.id
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {sub.first_name?.[0]}{sub.last_name?.[0]}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-foreground">
                                {sub.first_name} {sub.last_name}
                                {sub.user_id === user?.id && (
                                  <span className="ml-1.5 text-xs text-primary">(You)</span>
                                )}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div>
                            {sub.status === 'graded' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                                <CheckCircle className="h-3 w-3" />
                                {sub.grade}%
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-500">
                                <Clock className="h-3 w-3" />
                                Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {sub.status === 'graded' && sub.instructor_feedback && (
                          <div className="ml-10 mt-2 rounded-lg bg-muted/30 p-3 border-l-2 border-primary/40">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Instructor Feedback</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {sub.instructor_feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* All submissions (instructor view) */}
            {isInstructor && allSubmissions && (
              <div className="rounded-lg border border-border bg-card p-6 space-y-4">
                <h2 className="text-xl font-bold">
                  All Submissions ({allSubmissions.length})
                </h2>

                {allSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No submissions yet.
                  </p>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {allSubmissions.map((sub: ProjectSubmission) => (
                        <div
                          key={sub.id}
                          className="border border-border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {sub.firstName || sub.first_name} {sub.lastName || sub.last_name}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(sub.submittedAt || sub.submitted_at!).toLocaleDateString()}
                            </span>
                          </div>

                          {(sub.submissionUrl || sub.submission_url) && (sub.fileName || sub.file_name) && (
                            <button
                              type="button"
                              onClick={() => {
                                const url = sub.submissionUrl || sub.submission_url;
                                const name = sub.fileName || sub.file_name || 'submission';
                                downloadProjectFile(url!, name);
                              }}
                              className="inline-flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                            >
                              <Paperclip className="h-3 w-3" />
                              <Download className="h-3 w-3" />
                              {sub.fileName || sub.file_name}
                            </button>
                          )}

                          {(sub.submissionText || sub.submission_text) && (
                            <p className="text-sm text-foreground line-clamp-3">
                              {sub.submissionText || sub.submission_text}
                            </p>
                          )}

                          {sub.grade !== undefined && sub.grade !== null && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">Grade:</span>
                              <span className="text-primary font-bold">{sub.grade}%</span>
                            </div>
                          )}

                          {sub.instructorFeedback && (
                            <div className="bg-muted/30 rounded p-3">
                              <p className="text-xs font-medium mb-1">Feedback:</p>
                              <p className="text-sm">{sub.instructorFeedback || sub.instructor_feedback}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Project Details</h3>

              {project.maxFileSize && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Max file size:</span>
                  <span className="ml-2 font-medium">
                    {(project.maxFileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}

              {project.allowedFileTypes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Allowed types:</span>
                  <span className="ml-2 font-medium">{project.allowedFileTypes}</span>
                </div>
              )}

              <div className="text-sm">
                <span className="text-muted-foreground">Submissions:</span>
                <span className="ml-2 font-medium">
                  {project.submissionCount || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
