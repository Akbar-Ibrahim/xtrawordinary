import { PageSEO } from "@/components/page-seo";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Gamepad2, Brain, Users, Zap } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Exercise Your Mind",
    description:
      "Our word games are designed to challenge your vocabulary, improve your spelling, and keep your brain sharp.",
  },
  {
    icon: Gamepad2,
    title: "Multiple Game Modes",
    description:
      "From word guessing to anagrams and scrambles, enjoy a variety of game types that test different word skills.",
  },
  {
    icon: Zap,
    title: "Quick & Engaging",
    description:
      "Perfect for short breaks or longer play sessions. Each game is designed to be instantly fun and engaging.",
  },
  {
    icon: Users,
    title: "For Everyone",
    description:
      "Whether you're a word game novice or a vocabulary expert, our games offer different difficulty levels for all.",
  },
];

export default function About() {
  return (
    <div className="container mx-auto px-4 py-12">
      <PageSEO title="About" description="Learn about xtraWordinary — a collection of 23 word games built to improve vocabulary and challenge your brain." path="/about" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4">About xtraWordinary</h1>
        <p className="text-lg text-muted-foreground">
          xtraWordinary is your destination for fun and challenging word games.
          We believe that learning vocabulary should be enjoyable, and our
          collection of games is designed to make every moment of play both
          entertaining and educational.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="h-full hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-3xl mx-auto"
      >
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              At xtraWordinary, we're passionate about words and the joy they bring.
              Our mission is to create engaging word games that help players of
              all ages expand their vocabulary, improve their language skills,
              and most importantly, have fun while doing it. Whether you're
              looking for a quick mental workout or an extended gaming session,
              our games are here to challenge and entertain you.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
