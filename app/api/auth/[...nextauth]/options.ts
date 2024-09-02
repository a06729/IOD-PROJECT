import { Awaitable } from "next-auth"
import GitHubProvider, { GithubProfile } from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"



export const options={
    secret: process.env.AUTH_SECRET,
    providers:[
        GitHubProvider({
            clientId:process.env.GITHUB_ID!,
            clientSecret:process.env.GITHUB_Secret!,
            profile(profile, tokens):Awaitable<any>{
                console.log(`GitHub Profile:${profile}`)
                let userRole="GitHub User"

                if(profile?.email =="a06729@naver.com"){
                    userRole="admin";
                }

                return{
                    ...profile,
                    role:userRole,
                }
            },
        }),
        // GoogleProvider({
        //     clientId:process.env.GOOGLE_ID!,
        //     clientSecret:process.env.GOOGLE_Secret!,
        //     profile(profile, tokens):Awaitable<any>{
        //         console.log(`Google Profile:${profile}`)
        //         let userRole="Google User"
        //         if(profile?.email =="a06729@naver.com"){
        //             userRole="admin";
        //         }
        //         return{
        //             ...profile,
        //             id:profile.sub,
        //             role:userRole,
        //         }
               
        //     },
        // })
    ],
    callbacks:{
        async jwt({token,user}:{token:any,user:any}){
            if(user) token.role=user.role;
            return token;
        },
        async session({session,token}:{session:any,token:any}){
            if(session?.user)session.user.role=token.role
            return session;
        }
    },
}