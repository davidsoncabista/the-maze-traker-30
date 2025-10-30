"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Button, FlatList, TextInput, View, Text, StyleSheet, ScrollView } from 'react-native';
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, writeBatch, query, orderBy, onSnapshot, serverTimestamp, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { app } from '@/lib/firebase'; // Assuming you will create this file for firebase initialization
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// --- Types and Data ---

type ActorType = "Aliado" | "Inimigo" | "Neutro" | "Ambiente";
type Tier = "S" | "A" | "B" | "C" | "D";

interface Status {
  id: string;
  name: string;
  duration: number;
}

interface Actor {
  id: string;
  name: string;
  tier: Tier;
  initiative: number;
  type: ActorType;
  hp: number;
  maxHp: number;
  notes: string;
  statuses: Status[];
  initiativeTimestamp: Timestamp | null;
}

interface LogEntry {
  id: string;
  message: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  } | null;
}

// --- Components ---

function ActorCard({ actor, sessionId, addLogEntry }: { actor: Actor; sessionId: string; addLogEntry: (message: string) => Promise<void> }) {
  const firestore = getFirestore(app);
  
  const handleUpdate = async (data: Partial<Actor>) => {
    const actorRef = doc(firestore, `amazegame/${sessionId}/actors`, actor.id);
    const dataToUpdate = { ...data };
    if ('initiative' in dataToUpdate) {
        (dataToUpdate as any).initiativeTimestamp = serverTimestamp();
    }
    await updateDoc(actorRef, dataToUpdate);
  };
  
  const handleRemove = async () => {
    const actorRef = doc(firestore, `amazegame/${sessionId}/actors`, actor.id);
    await deleteDoc(actorRef);
    await addLogEntry(`Ator "${actor.name}" foi removido.`);
  };

  const addStatus = async () => {
    const newStatus: Status = { id: `status_${Date.now()}`, name: 'Novo Status', duration: 10 };
    await handleUpdate({ statuses: [...actor.statuses, newStatus] });
    await addLogEntry(`Adicionado status a "${actor.name}".`);
  };

  const removeStatus = async (statusId: string) => {
    await handleUpdate({ statuses: actor.statuses.filter(s => s.id !== statusId) });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TextInput 
            value={actor.name} 
            onChangeText={(name) => handleUpdate({ name })} 
            placeholder="Nome do Ator"
            style={styles.actorName}
        />
        <Button title="X" onPress={handleRemove} color="red" />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.statContainer}>
            <Text>Iniciativa:</Text>
            <TextInput 
                value={String(actor.initiative)} 
                onChangeText={(text) => handleUpdate({ initiative: parseInt(text) || 0 })} 
                keyboardType="numeric"
                style={styles.input}
            />
        </View>
        <View style={styles.statContainer}>
            <Text>HP:</Text>
            <TextInput 
                value={String(actor.hp)} 
                onChangeText={(text) => handleUpdate({ hp: parseInt(text) || 0 })} 
                keyboardType="numeric"
                style={styles.input}
            />
            <Text>/</Text>
            <TextInput 
                value={String(actor.maxHp)} 
                onChangeText={(text) => handleUpdate({ maxHp: parseInt(text) || 0 })} 
                keyboardType="numeric"
                style={styles.input}
            />
        </View>
        <TextInput 
            value={actor.notes}
            onChangeText={(notes) => handleUpdate({ notes })}
            placeholder="Anotações..."
            style={styles.notesInput}
        />
        <Button title="Adicionar Status" onPress={addStatus} />
        {actor.statuses.map(status => (
            <View key={status.id} style={styles.statusContainer}>
                <Text>{status.name} ({status.duration})</Text>
                <Button title="Remover" onPress={() => removeStatus(status.id)} />
            </View>
        ))}
      </View>
    </View>
  );
}

function HistoryLog({ sessionId }: { sessionId: string }) {
    const firestore = getFirestore(app);
    const logsCollectionRef = useMemo(() => collection(firestore, `amazegame/${sessionId}/logs`), [firestore, sessionId]);
    const [logsSnapshot] = useCollection(query(logsCollectionRef, orderBy('timestamp', 'desc')));
    const logs = useMemo(() => logsSnapshot?.docs.map(doc => ({ ...doc.data(), id: doc.id }) as LogEntry) || [], [logsSnapshot]);

    return (
        <View style={styles.historyContainer}>
            <Text style={styles.title}>Histórico de Rolagens</Text>
            <ScrollView>
                {logs.map((log) => (
                    <Text key={log.id} style={styles.logEntry}>
                        {log.message}
                    </Text>
                ))}
            </ScrollView>
        </View>
    );
}

export default function AmazegameScreen() {
    const firestore = getFirestore(app);
    const [sessionId, setSessionId] = useState<string | null>(`session_${Date.now()}`); // Simplified for mobile
    const [actorCounter, setActorCounter] = useState(1);

    const actorsCollectionRef = useMemo(() => sessionId ? collection(firestore, `amazegame/${sessionId}/actors`) : null, [firestore, sessionId]);
    
    const q = useMemo(() => 
        actorsCollectionRef 
            ? query(actorsCollectionRef, orderBy('initiative', 'desc'), orderBy('initiativeTimestamp', 'asc')) 
            : null, 
    [actorsCollectionRef]);
    
    const [actorsSnapshot] = useCollection(q);
    
    const actors = useMemo(() => actorsSnapshot?.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Actor[] || [], [actorsSnapshot]);

    const addLogEntry = async (message: string) => {
        if (!sessionId) return;
        const logsRef = collection(firestore, `amazegame/${sessionId}/logs`);
        await addDoc(logsRef, { message, timestamp: serverTimestamp() });
    };

    const addActor = async () => {
        if (!sessionId) return;
        const newActorName = `Novo Ator ${actorCounter}`;
        const newActorData: Omit<Actor, 'id'> = {
            name: newActorName,
            tier: 'D',
            initiative: 0,
            type: 'Neutro',
            hp: 10,
            maxHp: 10,
            notes: '',
            statuses: [],
            initiativeTimestamp: null
        };
        const actorsRef = collection(firestore, `amazegame/${sessionId}/actors`);
        const newDocRef = doc(actorsRef);
        
        const finalData = {
            ...newActorData,
            id: newDocRef.id,
            initiativeTimestamp: serverTimestamp()
        };

        await setDoc(newDocRef, finalData)
        
        await addLogEntry(`Ator "${newActorName}" foi adicionado.`);
        setActorCounter(prev => prev + 1);
    };

    const rollAllInitiatives = async () => {
        if (!actors || actors.length === 0 || !sessionId) return;
        await addLogEntry("Rolando iniciativas para todos...");
        const batch = writeBatch(firestore);
        const tierDice: Record<Tier, number> = { S: 4, A: 6, B: 8, C: 10, D: 12 };
        
        actors.forEach(actor => {
            const d = tierDice[actor.tier];
            const rolls = Array.from({ length: 3 }, () => Math.floor(Math.random() * d) + 1);
            const total = rolls.reduce((a, b) => a + b, 0);
            
            addLogEntry(`${actor.name} rolou 3d${d} (${rolls.join(' + ')}) = ${total}`);
            
            const actorRef = doc(firestore, `amazegame/${sessionId}/actors`, actor.id);
            batch.update(actorRef, { initiative: total, initiativeTimestamp: serverTimestamp() });
        });
        
        await batch.commit();
    };
    
    return (
        <ThemedView style={styles.container}>
            <ThemedText style={styles.title}>Maze Tracker</ThemedText>
            <View style={styles.controls}>
                <Button title="Adicionar Ator" onPress={addActor} />
                <Button title="Rolar Iniciativas" onPress={rollAllInitiatives} />
            </View>
            <FlatList
                data={actors}
                renderItem={({ item }) => <ActorCard actor={item} sessionId={sessionId!} addLogEntry={addLogEntry} />}
                keyExtractor={(item) => item.id}
                style={styles.list}
            />
            <HistoryLog sessionId={sessionId!} />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#1D3D47',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: '#2C4A52',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actorName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  cardBody: {
    marginTop: 10,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#1D3D47',
    color: 'white',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginHorizontal: 5,
    minWidth: 50,
    textAlign: 'center',
  },
  notesInput: {
      backgroundColor: '#1D3D47',
      color: 'white',
      padding: 10,
      borderRadius: 5,
      marginTop: 10,
  },
  statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 5,
      backgroundColor: '#3b5e66',
      padding: 5,
      borderRadius: 3
  },
  historyContainer: {
      height: 200,
      backgroundColor: '#112227',
      padding: 10,
      borderRadius: 5,
      marginTop: 10
  },
  logEntry: {
      color: '#aaccbb'
  }
});
