import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  contactId?: string;
  companyName: string;
  companyEmail: string;
  companyIndustry?: string;
  companyNotes?: string;
  messageType: "spontaneous" | "internship";
  postDetails?: {
    positionTitle?: string;
    description?: string;
    deadline?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: RequestPayload = await req.json();

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: resume } = await supabase
      .from("resumes")
      .select("skills, education, experience, projects")
      .eq("user_id", user.id)
      .maybeSingle();

    const userInfo = {
      fullName: profile?.full_name || user.email?.split("@")[0] || "Applicant",
      email: user.email,
      phone: profile?.phone || "",
      linkedIn: profile?.linkedin_url || "",
      bio: profile?.bio || "",
      targetPosition: profile?.target_position || "Internship",
      targetIndustry: profile?.target_industry || "",
      skills: resume?.skills || [],
      education: resume?.education || [],
      experience: resume?.experience || [],
      projects: resume?.projects || [],
    };

    let subject: string;
    let emailBody: string;

    if (payload.messageType === "spontaneous") {
      subject = `Candidature Spontanée - ${userInfo.targetPosition} - ${userInfo.fullName}`;
      
      emailBody = generateSpontaneousMessage({
        ...userInfo,
        companyName: payload.companyName,
        companyIndustry: payload.companyIndustry || "",
        companyNotes: payload.companyNotes || "",
      });
    } else {
      const positionTitle = payload.postDetails?.positionTitle || "Internship Position";
      subject = `Application for ${positionTitle} - ${userInfo.fullName}`;
      
      emailBody = generateInternshipMessage({
        ...userInfo,
        companyName: payload.companyName,
        positionTitle,
        description: payload.postDetails?.description || "",
        deadline: payload.postDetails?.deadline || "",
      });
    }

    const { data: application, error: insertError } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        contact_id: payload.contactId || null,
        recipient_email: payload.companyEmail,
        subject,
        email_body: emailBody,
        ai_generated: true,
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        application,
        message: "Personalized message generated successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error generating message:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate personalized message",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateSpontaneousMessage(data: any): string {
  const { fullName, email, phone, linkedIn, bio, targetPosition, skills, companyName, companyIndustry } = data;
  
  const skillsList = skills.length > 0 ? skills.slice(0, 5).join(", ") : "relevant technical skills";
  
  return `Objet: Candidature Spontanée - ${targetPosition}

Madame, Monsieur,

Je me permets de vous adresser ma candidature spontanée pour un poste de ${targetPosition} au sein de ${companyName}.

${bio ? `${bio}\n\n` : ""}Passionné(e) par ${companyIndustry || "votre secteur d'activité"}, je suis particulièrement intéressé(e) par les opportunités que ${companyName} pourrait m'offrir pour développer mes compétences et contribuer à vos projets.

Mes compétences principales incluent: ${skillsList}. Je suis convaincu(e) que mon profil et ma motivation constituent des atouts qui pourraient être bénéfiques à votre équipe.

Je reste à votre disposition pour un entretien afin de discuter de ma candidature et de la manière dont je pourrais contribuer au développement de ${companyName}.

Vous trouverez ci-joint mon CV pour plus de détails sur mon parcours.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

Cordialement,
${fullName}
${email}${phone ? `\n${phone}` : ""}${linkedIn ? `\n${linkedIn}` : ""}`;
}

function generateInternshipMessage(data: any): string {
  const { fullName, email, phone, linkedIn, bio, skills, education, companyName, positionTitle, description } = data;
  
  const skillsList = skills.length > 0 ? skills.slice(0, 5).join(", ") : "relevant skills";
  const educationText = education.length > 0 ? education[0] : "current studies";
  
  return `Dear Hiring Manager,

I am writing to express my strong interest in the ${positionTitle} position at ${companyName}.

${bio ? `${bio}\n\n` : ""}Currently pursuing ${educationText}, I am eager to apply my knowledge and skills in a practical setting. I am particularly drawn to ${companyName} because of your innovative work and reputation in the industry.

My key qualifications include:
- ${skillsList}
- Strong motivation to learn and contribute to meaningful projects
- Excellent problem-solving and teamwork abilities

${description ? `I was particularly excited to see that this position involves working on projects that align with my interests and career goals.\n\n` : ""}I am confident that my enthusiasm, combined with my technical skills, would make me a valuable addition to your team. I am eager to contribute to ${companyName}'s success while further developing my professional capabilities.

I would welcome the opportunity to discuss how my background and skills would be a great fit for this internship. Thank you for considering my application.

Please find my resume attached for your review.

Best regards,
${fullName}
${email}${phone ? `\n${phone}` : ""}${linkedIn ? `\n${linkedIn}` : ""}`;
}
